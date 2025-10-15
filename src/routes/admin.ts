import { Router, type Request, type Response, type RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/rbac';
import { formatError, formatZodError } from '../utils/errors';
import { heroBannerSchema, specialOfferSchema, laptopOfferSchema } from '../validation/schemas';
import { logger } from '../config/logger';

const router = Router();

const adminGuard: RequestHandler[] = [requireAuth as RequestHandler, requireRole('ADMIN') as RequestHandler];

type PagingQuery = { page?: string; pageSize?: string; status?: string };

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q.page ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '20', 10)));
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}

function computeDiscountPercent(priceCents: number, discountedCents: number) {
  if (priceCents <= 0) return 0;
  const pct = Math.round(((priceCents - discountedCents) / priceCents) * 100);
  return Math.max(0, Math.min(100, pct));
}

// Hero Banners CRUD
router.get('/admin/hero-banners', ...adminGuard, async (req: Request<{}, any, any, PagingQuery>, res: Response) => {
  const { status } = req.query;
  const { skip, take, page, pageSize } = parsePaging(req.query);
  const where: any = {};
  if (status && typeof status === 'string') where.status = status;
  const [items, total] = await Promise.all([
    prisma.heroBanner.findMany({ where, skip, take, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.heroBanner.count({ where }),
  ]);
  res.json({ items, page, pageSize, total });
});

router.post('/admin/hero-banners', ...adminGuard, async (req: Request, res: Response) => {
  const parsed = heroBannerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  try {
    const data = parsed.data as any;
    const normalized = {
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
    };
    const created = await prisma.heroBanner.create({ data: normalized });
    return res.status(201).json(created);
  } catch (error) {
    logger.error({ error }, 'Create hero banner failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create hero banner'));
  }
});

router.patch('/admin/hero-banners/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = heroBannerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const { id } = req.params;
  try {
    const data = parsed.data as any;
    const updateData: any = { ...data };
    if (data.validFrom !== undefined) {
      updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    }
    if (data.validTo !== undefined) {
      updateData.validTo = data.validTo ? new Date(data.validTo) : null;
    }
    const updated = await prisma.heroBanner.update({ where: { id }, data: updateData });
    return res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Update hero banner failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update hero banner'));
  }
});

// Soft delete: set status INACTIVE consistently
router.delete('/admin/hero-banners/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await prisma.heroBanner.update({ where: { id }, data: { status: 'INACTIVE' } });
    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Delete hero banner failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete hero banner'));
  }
});

// Special Offers CRUD
router.get('/admin/special-offers', ...adminGuard, async (req: Request<{}, any, any, PagingQuery>, res: Response) => {
  const { status } = req.query;
  const { skip, take, page, pageSize } = parsePaging(req.query);
  const where: any = {};
  if (status && typeof status === 'string') where.status = status;
  const [items, total] = await Promise.all([
    prisma.specialOffer.findMany({ where, skip, take, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.specialOffer.count({ where }),
  ]);
  return res.json({ items, page, pageSize, total });
});

router.post('/admin/special-offers', ...adminGuard, async (req: Request, res: Response) => {
  const parsed = specialOfferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const data = parsed.data;
  if (data.discountedCents > data.priceCents) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
  }
  const computed = computeDiscountPercent(data.priceCents, data.discountedCents);
  if (data.discountPercent != null && data.discountPercent !== computed) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount'));
  }
  try {
    const created = await prisma.specialOffer.create({
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        discountPercent: computed,
      },
    });
    return res.status(201).json(created);
  } catch (error) {
    logger.error({ error }, 'Create special offer failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create special offer'));
  }
});

router.patch('/admin/special-offers/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = specialOfferSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const data = parsed.data;
  const { id } = req.params;
  if (data.priceCents != null && data.discountedCents != null && data.discountedCents > data.priceCents) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
  }
  let updateData: any = { ...data };
  if (data.priceCents != null || data.discountedCents != null) {
    // Need current values to compute
    const current = await prisma.specialOffer.findUnique({ where: { id } });
    if (!current) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));
    const price = data.priceCents ?? current.priceCents;
    const disc = data.discountedCents ?? current.discountedCents;
    const computed = computeDiscountPercent(price, disc);
    if (data.discountPercent != null && data.discountPercent !== computed) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount'));
    }
    updateData.discountPercent = computed;
  }
  if (data.validFrom !== undefined) {
    updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
  }
  if (data.validTo !== undefined) {
    updateData.validTo = data.validTo ? new Date(data.validTo) : null;
  }
  try {
    const updated = await prisma.specialOffer.update({ where: { id }, data: updateData });
    return res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Update special offer failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update special offer'));
  }
});

router.delete('/admin/special-offers/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await prisma.specialOffer.update({ where: { id }, data: { status: 'INACTIVE' } });
    return res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Delete special offer failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete special offer'));
  }
});

// Laptop Offers CRUD (same rules)
router.get('/admin/laptop-offers', ...adminGuard, async (req: Request<{}, any, any, PagingQuery>, res: Response) => {
  const { status } = req.query;
  const { skip, take, page, pageSize } = parsePaging(req.query);
  const where: any = {};
  if (status && typeof status === 'string') where.status = status;
  const [items, total] = await Promise.all([
    prisma.laptopOffer.findMany({ where, skip, take, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.laptopOffer.count({ where }),
  ]);
  return res.json({ items, page, pageSize, total });
});

router.post('/admin/laptop-offers', ...adminGuard, async (req: Request, res: Response) => {
  const parsed = laptopOfferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const data = parsed.data;
  if (data.discountedCents > data.priceCents) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
  }
  const computed = computeDiscountPercent(data.priceCents, data.discountedCents);
  if (data.discountPercent != null && data.discountPercent !== computed) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount'));
  }
  try {
    const created = await prisma.laptopOffer.create({
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        discountPercent: computed,
      },
    });
    return res.status(201).json(created);
  } catch (error) {
    logger.error({ error }, 'Create laptop offer failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to create laptop offer'));
  }
});

router.patch('/admin/laptop-offers/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = laptopOfferSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const data = parsed.data;
  const { id } = req.params;
  if (data.priceCents != null && data.discountedCents != null && data.discountedCents > data.priceCents) {
    return res.status(400).json(formatError('VALIDATION_ERROR', 'discountedCents must be ≤ priceCents'));
  }
  let updateData: any = { ...data };
  if (data.priceCents != null || data.discountedCents != null) {
    const current = await prisma.laptopOffer.findUnique({ where: { id } });
    if (!current) return res.status(404).json(formatError('NOT_FOUND', 'Offer not found'));
    const price = data.priceCents ?? current.priceCents;
    const disc = data.discountedCents ?? current.discountedCents;
    const computed = computeDiscountPercent(price, disc);
    if (data.discountPercent != null && data.discountPercent !== computed) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'discountPercent inconsistent with price/discount'));
    }
    updateData.discountPercent = computed;
  }
  if (data.validFrom !== undefined) {
    updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
  }
  if (data.validTo !== undefined) {
    updateData.validTo = data.validTo ? new Date(data.validTo) : null;
  }
  try {
    const updated = await prisma.laptopOffer.update({ where: { id }, data: updateData });
    return res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Update laptop offer failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update laptop offer'));
  }
});

router.delete('/admin/laptop-offers/:id', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await prisma.laptopOffer.update({ where: { id }, data: { status: 'INACTIVE' } });
    res.json(updated);
  } catch (error) {
    logger.error({ error }, 'Delete laptop offer failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete laptop offer'));
  }
});

// Role management
router.post('/admin/users/:id/promote-admin', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.update({ where: { id }, data: { role: 'ADMIN' } });
  logger.info({ id: user.id, role: user.role }, 'User role changed to ADMIN');
  res.json(user);
});

router.post('/admin/users/:id/promote-agent', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.update({ where: { id }, data: { role: 'AGENT' } });
  logger.info({ id: user.id, role: user.role }, 'User role changed to AGENT');
  res.json(user);
});

router.post('/admin/users/:id/demote-user', ...adminGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.update({ where: { id }, data: { role: 'USER' } });
  logger.info({ id: user.id, role: user.role }, 'User role changed to USER');
  res.json(user);
});

export default router;