import request from 'supertest';
import express from 'express';
import uploadsRouter from '../routes/uploads';

// Mock AWS presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3/example/signed')
}));

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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/uploads', uploadsRouter);
  return app;
}

beforeAll(() => {
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_BUCKET = 'test-bucket';
  process.env.S3_ACCESS_KEY_ID = 'TESTKEY';
  process.env.S3_SECRET_ACCESS_KEY = 'TESTSECRET';
  process.env.S3_PUBLIC_BASE = 'https://cdn.example.com';
});

describe('POST /uploads/presign', () => {
  it('401 when no auth', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/uploads/presign')
      .send({ section: 'hero', filename: 'banner.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('403 when non-admin', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'USER')
      .send({ section: 'hero', filename: 'banner.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it('400 on invalid section, filename, or contentType', async () => {
    const app = makeApp();
    // invalid section
    const res1 = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ section: 'other', filename: 'banner.png', contentType: 'image/png' });
    expect(res1.status).toBe(400);

    // empty filename
    const res2 = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ section: 'hero', filename: '', contentType: 'image/png' });
    expect(res2.status).toBe(400);

    // invalid content type -> 415
    const res3 = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ section: 'hero', filename: 'banner.png', contentType: 'application/pdf' });
    expect([400, 415]).toContain(res3.status); // schema may enforce 400, route enforces 415
  });

  it('200 returns uploadUrl, publicUrl, key, expiresIn', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token')
      .set('x-role', 'ADMIN')
      .send({ section: 'hero', filename: 'summer Sale.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(typeof res.body.uploadUrl).toBe('string');
    expect(res.body.uploadUrl).toContain('https://s3');
    expect(typeof res.body.publicUrl).toBe('string');
    expect(typeof res.body.key).toBe('string');
    expect(res.body.expiresIn).toBe(300);

    const key: string = res.body.key;
    expect(key.startsWith('hero/')).toBe(true);
    // hero/YYYY/MM/DD/uuid-sanitized
    const parts = key.split('/');
    expect(parts.length).toBeGreaterThanOrEqual(5);
    expect((parts[2] || '').length).toBe(2); // MM
    expect((parts[3] || '').length).toBe(2); // DD
    const filenamePart = parts.slice(4).join('/');
    expect(filenamePart).toMatch(/^[0-9a-f-]+-summer-sale\.png$/);
  });
});