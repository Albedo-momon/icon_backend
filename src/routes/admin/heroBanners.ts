import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { formatError } from '../../utils/errors';
import { parsePagination } from '../../utils/api';
import { parseOrThrow } from '../../validation';
import { heroBannerCreateSchema, heroBannerUpdateSchema } from '../../validation/heroBanners';

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
    return res.json({ items, total, limit, offset });
  } catch (err) {
    req.log?.error({ err }, 'admin:hero:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list hero banners'));
  }
});

// Create (admin)
router.post('/', async (req, res) => {
  req.log?.info({}, 'admin:hero:create:enter');
  try {
    const dto = parseOrThrow(heroBannerCreateSchema, req.body);
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
    const status = err?.code === 'BAD_REQUEST' ? 400 : 500;
    req.log?.error({ err }, 'admin:hero:create:fail');
    return res.status(status).json(formatError(err?.code || 'INTERNAL_ERROR', err?.message || 'Failed to create hero banner', err?.details));
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
    return res.json(item);
  } catch (err) {
    req.log?.error({ err, id }, 'admin:hero:get:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to retrieve hero banner'));
  }
});

// Update (admin)
router.patch('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:hero:update:enter');
  try {
    const dto = parseOrThrow(heroBannerUpdateSchema, req.body);
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sort !== undefined) data.sortOrder = dto.sort;
    const updated = await prisma.heroBanner.update({ where: { id }, data });
    req.log?.info({ id }, 'admin:hero:update:ok');
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
    await prisma.heroBanner.delete({ where: { id } });
    req.log?.info({ id }, 'admin:hero:delete:ok');
    return res.status(204).send();
  } catch (err) {
    req.log?.error({ id, err }, 'admin:hero:delete:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete hero banner'));
  }
});

export default router;