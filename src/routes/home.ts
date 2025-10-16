import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/home', async (req, res) => {
  const now = new Date();
  const heroLimit = 5;
  const offersLimit = 10;
  const laptopsLimit = 10;
  const validityWindow = [
    { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
    { OR: [{ validTo: null }, { validTo: { gte: now } }] },
  ];

  const [heroBanners, specialOffers, laptopOffers] = await Promise.all([
    // Hero: public filter — ACTIVE only; order sort ASC, id DESC
    prisma.heroBanner.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      take: heroLimit,
    }),
    // Special: public filter — ACTIVE + validity window; order sort ASC, id DESC
    prisma.specialOffer.findMany({
      where: { status: 'ACTIVE', AND: validityWindow },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      take: offersLimit,
    }),
    // Laptop: public filter — ACTIVE only; order sort ASC, id DESC
    prisma.laptopOffer.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      take: laptopsLimit,
    }),
  ]);

  const counts = {
    heroBanners: heroBanners.length,
    specialOffers: specialOffers.length,
    laptopOffers: laptopOffers.length,
  };
  req.log?.info({ counts }, 'home:ok');
  res.json({ heroBanners, specialOffers, laptopOffers });
});

export default router;