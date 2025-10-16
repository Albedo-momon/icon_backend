import { Router, type Request, type Response, type RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/rbac';
import { formatError, formatZodError } from '../utils/errors';
import { heroBannerSchema, specialOfferSchema, laptopOfferSchema } from '../validation/schemas';
import { logger } from '../config/logger';
import heroAdminRouter from './admin/heroBanners';
import specialOffersRouter from './admin/specialOffers';
import laptopOffersRouter from './admin/laptopOffers';

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

// Hero Banners CRUD moved to /src/routes/admin/heroBanners.ts and mounted via admin router

// Special Offers CRUD moved to /src/routes/admin/specialOffers.ts and mounted via admin router

// Mount moved admin feature routers for test harness and compatibility
router.use('/admin/hero-banners', ...adminGuard, heroAdminRouter);
router.use('/admin/special-offers', ...adminGuard, specialOffersRouter);
router.use('/admin/laptop-offers', ...adminGuard, laptopOffersRouter);


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