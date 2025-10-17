import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { formatError, formatZodError } from '../../utils/errors';
import { parsePagination } from '../../utils/api';
import { parseOrThrow } from '../../validation';
import { heroBannerCreateSchema, heroBannerUpdateSchema } from '../../validation/heroBanners';
import { maybeDeleteOldAsset, extractS3Key } from '../../lib/assets';
import { deleteObjectKeyWithRetry } from '../../lib/s3';
import { addISTFields } from '../../utils/time';

const router = Router();

// List (admin): filters status?, q?; order sort ASC, id DESC; return { items, total, limit, offset }
router.get('/', async (req, res) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const { limit, offset } = parsePagination(req);
  const where: any = {};
  if (status) where.status = status;
  if (q && q.trim()) {
    where.title = { contains: q.trim(), mode: 'insensitive' };
  }
  req.log?.info({ filters: { status, q }, limit, offset }, 'admin:hero:list:enter');
  try {
    const [items, total] = await Promise.all([
      prisma.heroBanner.findMany({ where, skip: offset, take: limit, orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }] }),
      prisma.heroBanner.count({ where }),
    ]);
    req.log?.info({ count: items.length, total }, 'admin:hero:list:ok');
    const itemsWithIST = items.map(i => addISTFields(i, ['createdAt', 'updatedAt']));
    return res.json({ items: itemsWithIST, total, limit, offset });
  } catch (err) {
    req.log?.error({ err }, 'admin:hero:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list hero banners'));
  }
});

// Get by id (admin)
router.get('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:hero:get:enter');
  try {
    const item = await prisma.heroBanner.findUnique({ where: { id } });
    if (!item) {
      req.log?.warn?.({ id }, 'admin:hero:get:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Hero banner not found'));
    }
    req.log?.info({ id }, 'admin:hero:get:ok');
    return res.json(addISTFields(item, ['createdAt', 'updatedAt']));
  } catch (err) {
    req.log?.error({ err, id }, 'admin:hero:get:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to retrieve hero banner'));
  }
});

// Create (admin)
router.post('/', async (req, res) => {
  req.log?.info({}, 'admin:hero:create:enter');
  try {
    const parsed = heroBannerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn?.({ issues: parsed.error.issues }, 'admin:hero:create:validation_error');
      return res.status(400).json(formatZodError(parsed.error));
    }
    const dto = parsed.data;
    const created = await prisma.heroBanner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        status: dto.status,
        sortOrder: dto.sort ?? 0,
      },
    });
    req.log?.info({ id: created.id }, 'admin:hero:create:ok');
    return res.status(201).json(created);
  } catch (err: any) {
    req.log?.error({ err }, 'admin:hero:create:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create hero banner'));
  }
});

// Update (admin)
router.patch('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:hero:update:enter');
  try {
    const dto = parseOrThrow(heroBannerUpdateSchema, req.body);
    // Load current to compare imageUrl for deletion logic
    const current = await prisma.heroBanner.findUnique({ where: { id } });
    if (!current) {
      req.log?.warn?.({ id }, 'admin:hero:update:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Hero banner not found'));
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sort !== undefined) data.sortOrder = dto.sort;

    // Observability: changed fields checkpoint
    const changedFields = Object.keys(data);
    req.log?.info({ id, changedFields }, 'hero.update:enter');

    const incomingImageUrl = dto.imageUrl;
    const willReplaceImage = typeof incomingImageUrl === 'string' && incomingImageUrl.trim() && incomingImageUrl !== current.imageUrl;

    // Perform update first (never block on delete)
    const updated = await prisma.heroBanner.update({ where: { id }, data });
    req.log?.info({ id }, 'admin:hero:update:ok');
    req.log?.info({ id }, 'hero.update:ok');

    // After successful update: attempt asset cleanup if replacement occurred
    if (willReplaceImage) {
      const result = await maybeDeleteOldAsset('hero', current.imageUrl, { heroId: id });
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
    if (err?.code === 'BAD_REQUEST') {
      req.log?.warn?.({ id, err }, 'admin:hero:update:bad_request');
      return res.status(400).json(formatError('BAD_REQUEST', err?.message || 'Validation failed', err?.details));
    }
    req.log?.error({ id, err }, 'admin:hero:update:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update hero banner'));
  }
});

// Delete (admin) — hard delete, return 204
router.delete('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:hero:delete:enter');
  try {
    // Read row to capture imageUrl before delete
    const current = await prisma.heroBanner.findUnique({ where: { id } });
    if (!current) {
      req.log?.warn?.({ id }, 'admin:hero:delete:not_found');
      return res.status(404).json(formatError('NOT_FOUND', 'Hero banner not found'));
    }

    const oldKey = extractS3Key(current.imageUrl || '');

    // Perform DB delete first (authoritative)
    await prisma.heroBanner.delete({ where: { id } });
    req.log?.info({ action: 'banner.delete', id, reqId: (req as any).id, dbDeleted: true }, 'admin:hero:delete:db_ok');

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
    req.log?.error({ id, err }, 'admin:hero:delete:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete hero banner'));
  }
});

export default router;