import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { formatError } from '../../utils/errors';
import { parsePagination } from '../../utils/api';
import { parseOrThrow } from '../../validation';
import { specialOfferCreateSchema, specialOfferUpdateSchema } from '../../validation/specialOffers';
import { specialOfferSchema } from '../../validation/schemas';

const router = Router();

function computeDiscountPercentFloor(price: number, discounted: number) {
  if (price <= 0) return 0;
  const pct = Math.floor(((price - discounted) / price) * 100);
  return Math.max(0, Math.min(100, pct));
}

function validityWhere(now: Date) {
  return {
    OR: [
      { validFrom: null, validTo: null },
      { validFrom: { lte: now }, validTo: null },
      { validFrom: null, validTo: { gte: now } },
      { validFrom: { lte: now }, validTo: { gte: now } },
    ],
  } as const;
}

// List (admin): status?, activeNow?=true|false; pagination; order sort ASC, id DESC
router.get('/', async (req, res) => {
  const { status, activeNow } = req.query as { status?: string; activeNow?: string };
  const { limit, offset } = parsePagination(req);
  const where: any = {};
  if (status) where.status = status;
  const now = new Date();
  if (activeNow === 'true') {
    Object.assign(where, validityWhere(now));
  } else if (activeNow === 'false') {
    where.NOT = validityWhere(now);
  }
  req.log?.info({ filters: { status, activeNow }, limit, offset }, 'admin:special:list:enter');
  try {
    const [items, total] = await Promise.all([
      prisma.specialOffer.findMany({ where, skip: offset, take: limit, orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }] }),
      prisma.specialOffer.count({ where }),
    ]);
    req.log?.info({ count: items.length, total }, 'admin:special:list:ok');
    return res.json({ items, total, limit, offset });
  } catch (err) {
    req.log?.error({ err }, 'admin:special:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list special offers'));
  }
});

// Create (admin): supports Block C DTO; falls back to legacy schema for compatibility
router.post('/', async (req, res) => {
  req.log?.info({}, 'admin:special:create:enter');
  try {
    // Enforce imageUrl presence with clear error (non-empty)
    if (!Object.prototype.hasOwnProperty.call(req.body, 'imageUrl') || !String(req.body.imageUrl || '').trim()) {
      req.log?.warn?.({ keys: Object.keys(req.body) }, 'admin:special:create:reject:image_required');
      return res.status(400).json(formatError('VALIDATION_ERROR', 'imageUrl is required'));
    }
    // Try new DTO first
    let dto: any;
    let isNew = false;
    const parsedNew = specialOfferCreateSchema.safeParse(req.body);
    if (parsedNew.success) {
      dto = parsedNew.data;
      isNew = true;
    } else {
      dto = parseOrThrow(specialOfferSchema, req.body);
    }

    if (isNew) {
      const name: string = dto.name;
      const price: number = dto.price;
      const discounted: number = dto.discounted;
      const status: string = dto.status;
      const imageUrl: string = dto.imageUrl;
      const discountPercent = computeDiscountPercentFloor(price, discounted);
      const created = await prisma.specialOffer.create({
        data: {
          productName: name,
          imageUrl,
          priceCents: price,
          discountedCents: discounted,
          discountPercent,
          status,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validTo: dto.validTo ? new Date(dto.validTo) : null,
        },
      });
      req.log?.info({ id: created.id }, 'admin:special:create:ok');
      return res.status(201).json(created);
    } else {
      // Legacy payload path: verify discounted ≤ price and compute/check percent with ±1% tolerance
      const data = dto;
      // Enforce https for legacy payloads as well
      if (!String(data.imageUrl).startsWith('https://')) {
        req.log?.warn?.({ imageUrl: data.imageUrl }, 'admin:special:create:reject:image_https_required');
        return res.status(400).json(formatError('VALIDATION_ERROR', 'imageUrl must be https'));
      }
      if (data.discountedCents > data.priceCents) {
        return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
      }
      const computed = computeDiscountPercentFloor(data.priceCents, data.discountedCents);
      if (data.discountPercent != null && Math.abs(data.discountPercent - computed) > 1) {
        return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount (±1%)'));
      }
      const created = await prisma.specialOffer.create({
        data: {
          ...data,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validTo: data.validTo ? new Date(data.validTo) : null,
          discountPercent: computed,
        },
      });
      req.log?.info({ id: created.id }, 'admin:special:create:ok');
      return res.status(201).json(created);
    }
  } catch (err: any) {
    const status = err?.code === 'BAD_REQUEST' ? 400 : 500;
    req.log?.error({ err }, 'admin:special:create:fail');
    return res.status(status).json(formatError(err?.code || 'INTERNAL_ERROR', err?.message || 'Failed to create special offer', err?.details));
  }
});

// Get by id (admin)
router.get('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:special:get:enter');
  try {
    const item = await prisma.specialOffer.findUnique({ where: { id } });
    if (!item) {
      req.log?.warn?.({ id }, 'admin:special:get:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Special offer not found'));
    }
    req.log?.info({ id }, 'admin:special:get:ok');
    return res.json(item);
  } catch (err) {
    req.log?.error({ err, id }, 'admin:special:get:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to retrieve special offer'));
  }
});

// Update (admin): recompute discountPercent when price/discounted change; support Block C DTO
router.patch('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:special:update:enter');
  try {
    // Reject attempts to blank imageUrl explicitly
    if (Object.prototype.hasOwnProperty.call(req.body, 'imageUrl') && !String(req.body.imageUrl || '').trim()) {
      req.log?.warn?.({ id }, 'admin:special:update:reject:image_cannot_be_empty');
      return res.status(400).json(formatError('VALIDATION_ERROR', 'imageUrl cannot be empty'));
    }
    // Try new DTO first; fallback to legacy partial
    const parsedNew = specialOfferUpdateSchema.safeParse(req.body);
    const isNew = parsedNew.success;
    let data: any = {};

    if (isNew) {
      const dto = parsedNew.data;
      if (dto.name !== undefined) data.productName = dto.name;
      if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
      if (dto.validTo !== undefined) data.validTo = dto.validTo ? new Date(dto.validTo) : null;
      if (dto.price !== undefined) data.priceCents = dto.price;
      if (dto.discounted !== undefined) data.discountedCents = dto.discounted;
    } else {
      const parsedLegacy = specialOfferSchema.partial().safeParse(req.body);
      if (!parsedLegacy.success) {
        return res.status(400).json(formatError('BAD_REQUEST', 'Validation failed', parsedLegacy.error.issues));
      }
      const dto = parsedLegacy.data;
      // If legacy payload provides imageUrl, enforce https
      if (dto.imageUrl !== undefined && !String(dto.imageUrl).startsWith('https://')) {
        req.log?.warn?.({ id, imageUrl: dto.imageUrl }, 'admin:special:update:reject:image_https_required');
        return res.status(400).json(formatError('VALIDATION_ERROR', 'imageUrl must be https'));
      }
      data = { ...dto };
      if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
      if (dto.validTo !== undefined) data.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }

    // Fetch current to recompute discountPercent when necessary
    const current = await prisma.specialOffer.findUnique({ where: { id } });
    if (!current) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));

    const price = data.priceCents ?? current.priceCents;
    const disc = data.discountedCents ?? current.discountedCents;
    if (disc > price) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
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

    const updated = await prisma.specialOffer.update({ where: { id }, data });
    req.log?.info({ id }, 'admin:special:update:ok');
    // TODO: Phase 2 — when imageUrl is replaced, call maybeDeleteOldAsset('special', oldUrl, { specialId: id }) after successful update
    return res.json(updated);
  } catch (err: any) {
    req.log?.error({ id, err }, 'admin:special:update:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update special offer'));
  }
});

// Delete (admin) — soft delete (set INACTIVE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:special:delete:enter');
  try {
    const updated = await prisma.specialOffer.update({ where: { id }, data: { status: 'INACTIVE' } });
    req.log?.info({ id }, 'admin:special:delete:ok');
    return res.json(updated);
  } catch (err) {
    req.log?.error({ id, err }, 'admin:special:delete:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete special offer'));
  }
});

export default router;