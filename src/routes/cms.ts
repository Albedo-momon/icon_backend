import { Router } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { addISTFields } from '../utils/time';

const router = Router();

router.get('/cms', async (req, res) => {
  try {
    const now = new Date();

    // Get active hero banners with date filtering
    const banners = await prisma.heroBanner.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get active special offers with date filtering
    const offers = await prisma.specialOffer.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get active laptop offers with date filtering
    const laptops = await prisma.laptopOffer.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });

    logger.info(
      { bannersCount: banners.length, offersCount: offers.length, laptopsCount: laptops.length },
      'CMS data retrieved'
    );

    const bannersIST = banners.map(i => addISTFields(i, ['createdAt', 'updatedAt']));
    const offersIST = offers.map(i => addISTFields(i, ['createdAt', 'updatedAt']));
    const laptopsIST = laptops.map(i => addISTFields(i, ['createdAt', 'updatedAt']));

    res.json({ banners: bannersIST, offers: offersIST, laptops: laptopsIST });
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve CMS data');
    res.status(500).json({ error: 'Failed to retrieve CMS data' });
  }
});

export default router;