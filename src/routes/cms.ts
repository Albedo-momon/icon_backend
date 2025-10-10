import { Router } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';

const router = Router();

router.get('/cms', async (req, res) => {
  try {
    const now = new Date();
    
    // Get active banners with date filtering
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } }
        ]
      },
      orderBy: { sortOrder: 'asc' }
    });

    // Get active offers with date filtering
    const offers = await prisma.offer.findMany({
      where: {
        isActive: true,
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } }
        ]
      },
      orderBy: { sortOrder: 'asc' }
    });

    // Get active products
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        inStock: true
      },
      orderBy: { sortOrder: 'asc' }
    });

    logger.info({ 
      bannersCount: banners.length, 
      offersCount: offers.length, 
      productsCount: products.length 
    }, 'CMS data retrieved');

    res.json({
      banners,
      offers,
      products
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve CMS data');
    res.status(500).json({ error: 'Failed to retrieve CMS data' });
  }
});

export default router;