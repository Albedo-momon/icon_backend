import { Router } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';

const router = Router();

router.get('/healthz', async (req, res) => {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Health check passed');
    res.json({ ok: true, db: true });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({ ok: false, db: false, error: 'Database connection failed' });
  }
});

export default router;