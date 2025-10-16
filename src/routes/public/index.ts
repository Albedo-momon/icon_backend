import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { parsePagination } from '../../utils/api';
import { formatError } from '../../utils/errors';

const publicRouter = Router();

// Public: list active hero banners, order sort ASC, id DESC, supports limit/offset; returns array only
publicRouter.get('/hero-banners', async (req, res) => {
  const { limit, offset } = parsePagination(req);
  req.log?.info({ limit, offset }, 'public:hero:list:enter');
  try {
    const items = await prisma.heroBanner.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    });
    req.log?.info({ count: items.length }, 'public:hero:list:ok');
    return res.json(items);
  } catch (err) {
    req.log?.error({ err }, 'public:hero:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list hero banners'));
  }
});

// Public: list active special offers with validity window; order sort ASC, id DESC
publicRouter.get('/special-offers', async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const now = new Date();
  req.log?.info({ limit, offset }, 'public:special:list:enter');
  try {
    const items = await prisma.specialOffer.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: null },
          { validFrom: null, validTo: { gte: now } },
          { validFrom: { lte: now }, validTo: { gte: now } },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    });
    req.log?.info({ count: items.length }, 'public:special:list:ok');
    return res.json(items);
  } catch (err) {
    req.log?.error({ err }, 'public:special:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list special offers'));
  }
});

export default publicRouter;
// Public: list active laptop offers; order sort ASC, id DESC; supports pagination
publicRouter.get('/laptop-offers', async (req, res) => {
  const { limit, offset } = parsePagination(req);
  req.log?.info({ limit, offset }, 'public:laptop:list:enter');
  try {
    const items = await prisma.laptopOffer.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    });
    req.log?.info({ count: items.length }, 'public:laptop:list:ok');
    return res.json(items);
  } catch (err) {
    req.log?.error({ err }, 'public:laptop:list:fail');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to list laptop offers'));
  }
});