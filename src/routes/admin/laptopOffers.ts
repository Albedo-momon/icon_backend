import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { formatError, formatZodError } from '../../utils/errors';
import { parsePagination } from '../../utils/api';
import { parseOrThrow } from '../../validation';
import { laptopOfferCreateSchema, laptopOfferUpdateSchema, type LaptopOfferCreate, type LaptopOfferUpdate } from '../../validation/laptopOffers';
import { addISTFields } from '../../utils/time';
import { maybeDeleteOldAsset, extractS3Key } from '../../lib/assets';
import { deleteObjectKeyWithRetry } from '../../lib/s3';

const router = Router();

function computeDiscountPercentFloor(price: number, discounted: number) {
  if (price <= 0) return 0;
  const pct = Math.floor(((price - discounted) / price) * 100);
  return Math.max(0, Math.min(100, pct));
}


// List (admin): q? filters name, status?, activeNow?; pagination; order sort ASC, id DESC
router.get('/', async (req, res) => {
  const { q, status, activeNow } = req.query as { q?: string; status?: string; activeNow?: string };
  const { limit, offset } = parsePagination(req);
  const where: any = {};
  if (status) where.status = status;
  // Filter by productName in DB
  if (q) where.productName = { contains: q, mode: 'insensitive' };
  const now = new Date();
  if (activeNow === 'true') {
    Object.assign(where, {
      OR: [
        { validFrom: null, validTo: null },
        { validFrom: { lte: now }, validTo: null },
        { validFrom: null, validTo: { gte: now } },
        { validFrom: { lte: now }, validTo: { gte: now } },
      ],
    });
  } else if (activeNow === 'false') {
    where.NOT = {
      OR: [
        { validFrom: null, validTo: null },
        { validFrom: { lte: now }, validTo: null },
        { validFrom: null, validTo: { gte: now } },
        { validFrom: { lte: now }, validTo: { gte: now } },
      ],
    };
  }
  req.log?.info({ filters: { q, status, activeNow }, limit, offset }, 'admin:laptop:list:enter');
  try {
    const [items, total] = await Promise.all([
      prisma.laptopOffer.findMany({ where, skip: offset, take: limit, orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }] }),
      prisma.laptopOffer.count({ where }),
    ]);
    req.log?.info({ count: items.length, total }, 'admin:laptop:list:ok');
    const itemsWithIST = items.map(i => addISTFields(i, ['createdAt', 'updatedAt']));
    return res.json({ items: itemsWithIST, total, limit, offset });
  } catch (err) {
    req.log?.error({ err }, 'admin:laptop:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list laptop offers'));
  }
});

// Get by id (admin)
router.get('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:get:enter');
  try {
    const item = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!item) {
      req.log?.warn?.({ id }, 'admin:laptop:get:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Laptop offer not found'));
    }
    req.log?.info({ id }, 'admin:laptop:get:ok');
    return res.json(addISTFields(item, ['createdAt', 'updatedAt']));
  } catch (err) {
    req.log?.error({ err, id }, 'admin:laptop:get:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to retrieve laptop offer'));
  }
});

// Create (admin): strict DTO from validation package
router.post('/', async (req, res) => {
  req.log?.info({}, 'admin:laptop:create:enter');
  try {
    const parsed = laptopOfferCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn?.({ issues: parsed.error.issues }, 'admin:laptop:create:validation_error');
      return res.status(400).json(formatZodError(parsed.error));
    }
    const dto: LaptopOfferCreate = parsed.data;
    const discountPercent = computeDiscountPercentFloor(dto.price, dto.discounted);
    const created = await prisma.laptopOffer.create({
      data: {
        productName: dto.model,
        imageUrl: dto.imageUrl,
        price: dto.price,
        discounted: dto.discounted,
        discountPercent,
        status: dto.status,
      },
    });
    req.log?.info({ id: created.id }, 'admin:laptop:create:ok');
    return res.status(201).json(created);
  } catch (err: any) {
    const status = err?.code === 'BAD_REQUEST' ? 400 : 500;
    req.log?.error({ err }, 'admin:laptop:create:fail');
    return res.status(status).json(formatError(err?.code || 'INTERNAL_ERROR', err?.message || 'Failed to create laptop offer', err?.details));
  }
});

// Update (admin): recompute discountPercent when price/discounted change; strict DTO
router.patch('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:update:enter');
  try {
    // Reject attempts to blank imageUrl explicitly
    if (Object.prototype.hasOwnProperty.call(req.body, 'imageUrl') && !String(req.body.imageUrl || '').trim()) {
      req.log?.warn?.({ id }, 'admin:laptop:update:reject:image_cannot_be_empty');
      return res.status(400).json(formatError('VALIDATION_ERROR', 'imageUrl cannot be empty'));
    }

    const dto: LaptopOfferUpdate = parseOrThrow(laptopOfferUpdateSchema, req.body);
    const data: any = {};
    if (dto.model !== undefined) data.productName = dto.model;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.discounted !== undefined) data.discounted = dto.discounted;

    // Fetch current to recompute discountPercent when necessary
    const current = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!current) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));

    const price = data.price ?? current.price;
    const disc = data.discounted ?? current.discounted;
    if (disc > price) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'discounted must be ≤ price'));
    }
    const computed = computeDiscountPercentFloor(price, disc);
    // If client provided discountPercent, enforce ±1% tolerance against computed
    if (Object.prototype.hasOwnProperty.call(req.body, 'discountPercent')) {
      const provided = req.body.discountPercent;
      if (provided != null && Math.abs(provided - computed) > 1) {
        return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount (±1%)'));
      }
    }
    data.discountPercent = computed;

    // Determine if image will be replaced
    const incomingImageUrl = dto.imageUrl;
    const willReplaceImage = typeof incomingImageUrl === 'string' && incomingImageUrl.trim() && incomingImageUrl !== current.imageUrl;

    const updated = await prisma.laptopOffer.update({ where: { id }, data });
    req.log?.info({ id }, 'admin:laptop:update:ok');

    // After successful update: attempt asset cleanup if replacement occurred
    if (willReplaceImage) {
      const result = await maybeDeleteOldAsset('laptop', current.imageUrl, { laptopId: id });
      if (result.deleted && result.key) {
        req.log?.info({ oldKey: result.key }, 'asset:deleted');
      } else if (result.reason === 'in_use' && result.key) {
        req.log?.info({ oldKey: result.key }, 'asset:skip_in_use');
      } else if (result.reason === 'invalid_domain') {
        req.log?.info({}, 'asset:skip_invalid_domain');
      } else {
        req.log?.warn({ oldKey: result.key, err: result.error?.message }, 'asset:delete_failed');
      }
    }

    return res.json(updated);
  } catch (err: any) {
    req.log?.error({ id, err }, 'admin:laptop:update:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update laptop offer'));
  }
});

// Delete (admin) — hard delete, attempt S3 cleanup
router.delete('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:delete:enter');
  try {
    // Read row to capture imageUrl before delete
    const current = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!current) {
      req.log?.warn?.({ id }, 'admin:laptop:delete:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Laptop offer not found'));
    }

    const oldKey = extractS3Key(current.imageUrl || '');

    // Perform DB delete first (authoritative)
    await prisma.laptopOffer.delete({ where: { id } });
    req.log?.info({ action: 'laptop.delete', id, reqId: (req as any).id, dbDeleted: true }, 'admin:laptop:delete:db_ok');

    let s3Result: { attempted: boolean; deleted: boolean; key: string | null; attempts: number; error?: string } = {
      attempted: false,
      deleted: false,
      key: null,
      attempts: 0,
    };

    // Attempt S3 deletion best-effort with retry/backoff
    if (oldKey) {
      s3Result.attempted = true;
      s3Result.key = oldKey;
      const result = await deleteObjectKeyWithRetry(oldKey, {
        timeoutMs: 3000,
        maxAttempts: 3,
        onAttempt: ({ attempt, success, err }) => {
          req.log?.info({ action: 's3.delete', key: oldKey, attempt, success, err: err?.message }, 'asset:delete_attempt');
        },
      });
      s3Result.attempts = result.attempts;
      s3Result.deleted = !!result.ok;
      if (result.ok) {
        req.log?.info({ decision: 's3_cleanup_success', key: oldKey }, 'asset:deleted');
      } else {
        s3Result.error = result.error?.message || 'S3 delete failed';
        req.log?.warn({ decision: 's3_cleanup_failed', key: oldKey, err: result.error?.message }, 'asset:delete_failed');
      }
    } else {
      req.log?.info({ decision: 's3_cleanup_unparsable', id }, 'asset:skip_invalid_domain');
    }
    return res.status(200).json({ ok: true, id, s3Deleted: !!s3Result.deleted, s3DeleteError: s3Result.attempted ? (s3Result.deleted ? null : (s3Result.error || 's3_delete_failed')) : 'unparsable_or_missing_key' });
  } catch (err) {
    req.log?.error({ id, err }, 'admin:laptop:delete:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete laptop offer'));
  }
});

export default router;