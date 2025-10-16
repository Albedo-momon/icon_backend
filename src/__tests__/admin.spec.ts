import request from 'supertest';
import express from 'express';
import adminRoutes from '../routes/admin';
import homeRoutes from '../routes/home';

// Mock auth guards
jest.mock('../middleware/requireAuth', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing auth' } });
    return next();
  }
}));

jest.mock('../middleware/rbac', () => ({
  requireRole: (_required: 'ADMIN') => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-role'] as string) || '';
    if (role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Requires ADMIN' } });
    }
    return next();
  }
}));

// Mock Prisma: create inside factory and access via require in tests
jest.mock('../db/prisma', () => {
  const prismaFns = {
    heroBanner: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    specialOffer: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    laptopOffer: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
  };
  return { prisma: prismaFns };
});

describe('Admin CRUD and Home aggregator', () => {
  const { prisma: prismaFns } = require('../db/prisma');
  const app = express();
  app.use(express.json());
  app.use('/', adminRoutes);
  app.use('/', homeRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin on POST /admin/hero-banners', async () => {
    const res = await request(app)
      .post('/admin/hero-banners')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'USER')
      .send({ imageUrl: 'https://example.com/banner.png' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates validFrom must be before validTo for hero banner', async () => {
    const res = await request(app)
      .post('/admin/hero-banners')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ imageUrl: 'https://example.com/banner.png', validFrom: '2025-10-15T10:00:00.000Z', validTo: '2025-10-15T09:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates special offer and enforces discountPercent ±1% tolerance', async () => {
    prismaFns.specialOffer.create.mockResolvedValueOnce({ id: '1' });

    // Fails when provided percent deviates >1%
    let res = await request(app)
      .post('/admin/special-offers')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ imageUrl: 'https://x/img.png', productName: 'X', priceCents: 10000, discountedCents: 5000, discountPercent: 53 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // Succeeds within tolerance
    res = await request(app)
      .post('/admin/special-offers')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ imageUrl: 'https://x/img.png', productName: 'X', priceCents: 10000, discountedCents: 5000, discountPercent: 51 });
    expect(res.status).toBe(201);
  });

  it('PATCH special offer cross-checks discountPercent with current values', async () => {
    prismaFns.specialOffer.findUnique.mockResolvedValue({ id: 'abc', priceCents: 10000, discountedCents: 9000 });
    prismaFns.specialOffer.update.mockResolvedValue({ id: 'abc' });

    // Deviates by >1% from computed 10%
    let res = await request(app)
      .patch('/admin/special-offers/abc')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ discountPercent: 8 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // Within tolerance
    res = await request(app)
      .patch('/admin/special-offers/abc')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ discountPercent: 9 });
    expect(res.status).toBe(200);
  });

  it('GET /home applies section limits', async () => {
    // Return arrays but we assert that take limit is respected in query args
    prismaFns.heroBanner.findMany.mockResolvedValue([]);
    prismaFns.specialOffer.findMany.mockResolvedValue([]);
    prismaFns.laptopOffer.findMany.mockResolvedValue([]);

    const res = await request(app).get('/home');
    expect(res.status).toBe(200);
    expect(prismaFns.heroBanner.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(prismaFns.specialOffer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(prismaFns.laptopOffer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});