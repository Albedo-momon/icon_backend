import express from 'express';
import request from 'supertest';
import heroRouter from '../routes/admin/heroBanners';

jest.mock('../db/prisma', () => {
  return {
    prisma: {
      heroBanner: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    },
  };
});
const { prisma } = require('../db/prisma');

jest.mock('../lib/s3', () => {
  return {
    deleteObjectKeyWithRetry: jest.fn(),
    getS3PublicBase: jest.fn(() => process.env.S3_PUBLIC_BASE || ''),
  };
});
const { deleteObjectKeyWithRetry } = require('../lib/s3');

describe('DELETE /admin/hero-banners/:id with S3 cleanup', () => {
  const BASE = 'https://amzn-s3-icon-assets.s3.ap-south-1.amazonaws.com';
  const app = express();
  app.use(express.json());
  app.use('/', heroRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_PUBLIC_BASE = BASE;
  });

  it('returns 404 when not found', async () => {
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(app).delete('/non-existent');
    expect(res.status).toBe(404);
  });

  it('deletes DB first, then deletes S3 with flags', async () => {
    const id = 'h1';
    const oldUrl = `${BASE}/hero/2025/10/15/old.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id, imageUrl: oldUrl });
    (prisma.heroBanner.delete as jest.Mock).mockResolvedValue({});
    (deleteObjectKeyWithRetry as jest.Mock).mockResolvedValue({ ok: true, attempts: 1 });

    const res = await request(app).delete('/h1');
    expect(res.status).toBe(200);
    expect(prisma.heroBanner.delete).toHaveBeenCalledWith({ where: { id } });
    expect(deleteObjectKeyWithRetry).toHaveBeenCalled();
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(id);
    expect(res.body.s3Deleted).toBe(true);
    expect(res.body.s3DeleteError).toBeNull();
  });

  it('handles unparsable URL and skips S3', async () => {
    const id = 'h2';
    const badUrl = `https://cdn.example.com/hero/2025/10/15/old.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id, imageUrl: badUrl });
    (prisma.heroBanner.delete as jest.Mock).mockResolvedValue({});

    const res = await request(app).delete('/h2');
    expect(res.status).toBe(200);
    expect(deleteObjectKeyWithRetry).not.toHaveBeenCalled();
    expect(res.body.ok).toBe(true);
    expect(res.body.s3Deleted).toBe(false);
    expect(res.body.s3DeleteError).toBe('unparsable_or_missing_key');
  });

  it('returns flags with error when S3 delete fails after retries', async () => {
    const id = 'h3';
    const oldUrl = `${BASE}/hero/2025/10/15/old.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id, imageUrl: oldUrl });
    (prisma.heroBanner.delete as jest.Mock).mockResolvedValue({});
    (deleteObjectKeyWithRetry as jest.Mock).mockResolvedValue({ ok: false, attempts: 3, error: new Error('Timeout') });

    const res = await request(app).delete('/h3');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.s3Deleted).toBe(false);
    expect(res.body.s3DeleteError).toBe('Timeout');
  });
});