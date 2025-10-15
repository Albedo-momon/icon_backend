import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/home', async (_req, res) => {
  const now = new Date();
  const dateWindow = [
    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
  ];

  const [heroBanners, specialOffers, laptopOffers] = await Promise.all([
    prisma.heroBanner.findMany({
      where: { status: 'ACTIVE', AND: dateWindow },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.specialOffer.findMany({
      where: { status: 'ACTIVE', AND: dateWindow },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.laptopOffer.findMany({
      where: { status: 'ACTIVE', AND: dateWindow },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  res.json({ heroBanners, specialOffers, laptopOffers });
});

export default router;