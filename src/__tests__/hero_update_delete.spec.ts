import express from 'express';
import request from 'supertest';
import heroRouter from '../routes/admin/heroBanners';

jest.mock('../db/prisma', () => {
  return {
    prisma: {
      heroBanner: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    },
  };
});
const { prisma } = require('../db/prisma');

jest.mock('../lib/s3', () => {
  return {
    getS3PublicBase: jest.fn(() => process.env.S3_PUBLIC_BASE || ''),
    deleteObjectKey: jest.fn(),
    presignPutUrl: jest.fn(),
    buildObjectKey: jest.fn(),
    sanitizeFilename: jest.fn(),
    s3: {},
  };
});
const { deleteObjectKey } = require('../lib/s3');

describe('Hero PATCH image replacement triggers S3 delete', () => {
  const BASE = 'https://amzn-s3-icon-assets.s3.ap-south-1.amazonaws.com';
  const app = express();
  app.use(express.json());
  app.use('/', heroRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_REGION = 'ap-south-1';
    process.env.S3_BUCKET = 'amzn-s3-icon-assets';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'test';
    process.env.S3_PUBLIC_BASE = BASE;
  });

  it('replacing image deletes old S3 object after update', async () => {
    const oldUrl = `${BASE}/hero/2025/10/15/old-uuid-banner.png`;
    const newUrl = `${BASE}/hero/2025/10/15/new-uuid-banner.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: oldUrl });
    (prisma.heroBanner.update as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: newUrl });
    (prisma.heroBanner.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app).patch('/h1').send({ imageUrl: newUrl });
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe(newUrl);
    expect(deleteObjectKey).toHaveBeenCalledWith('hero/2025/10/15/old-uuid-banner.png');
  });

  it('no delete when image unchanged', async () => {
    const url = `${BASE}/hero/2025/10/15/same-uuid-banner.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: url });
    (prisma.heroBanner.update as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: url });

    const res = await request(app).patch('/h1').send({ imageUrl: url });
    expect(res.status).toBe(200);
    expect(deleteObjectKey).not.toHaveBeenCalled();
  });

  it('no delete for non-bucket old URL', async () => {
    const oldUrl = `https://cdn.example.com/hero/2025/10/15/old.png`;
    const newUrl = `${BASE}/hero/2025/10/15/new.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: oldUrl });
    (prisma.heroBanner.update as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: newUrl });
    (prisma.heroBanner.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app).patch('/h1').send({ imageUrl: newUrl });
    expect(res.status).toBe(200);
    expect(deleteObjectKey).not.toHaveBeenCalled();
  });

  it('delete failure still returns 200 and logs warning', async () => {
    const oldUrl = `${BASE}/hero/2025/10/15/old-uuid-banner.png`;
    const newUrl = `${BASE}/hero/2025/10/15/new-uuid-banner.png`;
    (prisma.heroBanner.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: oldUrl });
    (prisma.heroBanner.update as jest.Mock).mockResolvedValue({ id: 'h1', imageUrl: newUrl });
    (prisma.heroBanner.findFirst as jest.Mock).mockResolvedValue(null);
    (deleteObjectKey as jest.Mock).mockRejectedValue(new Error('S3 delete failed'));

    const res = await request(app).patch('/h1').send({ imageUrl: newUrl });
    expect(res.status).toBe(200);
    expect(deleteObjectKey).toHaveBeenCalled();
  });
});