import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { formatError } from '../../utils/errors';
import { parsePagination } from '../../utils/api';
import { parseOrThrow } from '../../validation';
import { laptopOfferCreateSchema, laptopOfferUpdateSchema } from '../../validation/laptopOffers';
import { laptopOfferSchema } from '../../validation/schemas';

const router = Router();

function computeDiscountPercentFloor(price: number, discounted: number) {
  if (price <= 0) return 0;
  const pct = Math.floor(((price - discounted) / price) * 100);
  return Math.max(0, Math.min(100, pct));
}

// List (admin): status?, q? matches model(productName), pagination; order sort ASC, id DESC
router.get('/', async (req, res) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const { limit, offset } = parsePagination(req);
  const where: any = {};
  if (status) where.status = status;
  if (q) where.productName = { contains: q, mode: 'insensitive' };
  req.log?.info({ filters: { status, q }, limit, offset }, 'admin:laptop:list:enter');
  try {
    const [items, total] = await Promise.all([
      prisma.laptopOffer.findMany({ where, skip: offset, take: limit, orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }] }),
      prisma.laptopOffer.count({ where }),
    ]);
    req.log?.info({ count: items.length, total }, 'admin:laptop:list:ok');
    return res.json({ items, total, limit, offset });
  } catch (err) {
    req.log?.error({ err }, 'admin:laptop:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list laptop offers'));
  }
});

// Create (admin): supports Block D DTO; falls back to legacy schema for compatibility
router.post('/', async (req, res) => {
  req.log?.info({}, 'admin:laptop:create:enter');
  try {
    // Try new DTO first
    let dto: any;
    let isNew = false;
    const parsedNew = laptopOfferCreateSchema.safeParse(req.body);
    if (parsedNew.success) {
      dto = parsedNew.data;
      isNew = true;
    } else {
      dto = parseOrThrow(laptopOfferSchema, req.body);
    }

    if (isNew) {
      const model: string = dto.model;
      const price: number = dto.price;
      const discounted: number = dto.discounted;
      const status: string = dto.status;
      const imageUrl: string = dto.imageUrl ?? 'https://via.placeholder.com/400x300/333333/ffffff?text=Laptop+Offer';
      const discountPercent = computeDiscountPercentFloor(price, discounted);
      const created = await prisma.laptopOffer.create({
        data: {
          productName: model,
          imageUrl,
          priceCents: price,
          discountedCents: discounted,
          discountPercent,
          status,
        },
      });
      req.log?.info({ id: created.id }, 'admin:laptop:create:ok');
      return res.status(201).json(created);
    } else {
      // Legacy payload path: verify discounted ≤ price and compute/check percent with ±1% tolerance
      const data = dto;
      if (data.discountedCents > data.priceCents) {
        return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
      }
      const computed = computeDiscountPercentFloor(data.priceCents, data.discountedCents);
      if (data.discountPercent != null && Math.abs(data.discountPercent - computed) > 1) {
        return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount (±1%)'));
      }
      const created = await prisma.laptopOffer.create({
        data: {
          ...data,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validTo: data.validTo ? new Date(data.validTo) : null,
          discountPercent: computed,
        },
      });
      req.log?.info({ id: created.id }, 'admin:laptop:create:legacy:ok');
      return res.status(201).json(created);
    }
  } catch (err: any) {
    req.log?.error({ err }, 'admin:laptop:create:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create laptop offer'));
  }
});

// Get by ID (admin)
router.get('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:get:enter');
  try {
    const item = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!item) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));
    return res.json(item);
  } catch (err) {
    req.log?.error({ id, err }, 'admin:laptop:get:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to retrieve laptop offer'));
  }
});

// Update (admin): recompute discountPercent when price/discounted change; support Block D DTO
router.patch('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:update:enter');
  try {
    // Try new DTO first; fallback to legacy partial
    const parsedNew = laptopOfferUpdateSchema.safeParse(req.body);
    const isNew = parsedNew.success;
    let data: any = {};

    if (isNew) {
      const dto = parsedNew.data;
      if (dto.model !== undefined) data.productName = dto.model;
      if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.price !== undefined) data.priceCents = dto.price;
      if (dto.discounted !== undefined) data.discountedCents = dto.discounted;
      // specs ignored (no column), but accepted in payload
    } else {
      const parsedLegacy = laptopOfferSchema.partial().safeParse(req.body);
      if (!parsedLegacy.success) {
        return res.status(400).json(formatError('BAD_REQUEST', 'Validation failed', parsedLegacy.error.issues));
      }
      const dto = parsedLegacy.data;
      data = { ...dto };
      if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
      if (dto.validTo !== undefined) data.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }

    // Fetch current to recompute discountPercent when necessary
    const current = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!current) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));

    const price = data.priceCents ?? current.priceCents;
    const disc = data.discountedCents ?? current.discountedCents;
    if (disc > price) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
    }
    data.discountPercent = computeDiscountPercentFloor(price, disc);

    const updated = await prisma.laptopOffer.update({ where: { id }, data });
    req.log?.info({ id }, 'admin:laptop:update:ok');
    // TODO: Phase 2 — when imageUrl is replaced, call maybeDeleteOldAsset('laptop', oldUrl, { laptopId: id }) after successful update
    return res.json(updated);
  } catch (err: any) {
    req.log?.error({ id, err }, 'admin:laptop:update:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update laptop offer'));
  }
});

// Delete (admin) — soft delete (set INACTIVE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params as { id: string };
  req.log?.info({ id }, 'admin:laptop:delete:enter');
  try {
    const updated = await prisma.laptopOffer.update({ where: { id }, data: { status: 'INACTIVE' } });
    req.log?.info({ id }, 'admin:laptop:delete:ok');
    return res.json(updated);
  } catch (err) {
    req.log?.error({ id, err }, 'admin:laptop:delete:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete laptop offer'));
  }
});

export default router;