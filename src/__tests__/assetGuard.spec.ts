import { isAssetKeyInUse } from '../lib/assets';

jest.mock('../db/prisma', () => {
  return {
    prisma: {
      heroBanner: {
        findFirst: jest.fn(),
      },
      // specialOffer and laptopOffer can be added later
    },
  };
});

const { prisma } = require('../db/prisma');

describe('isAssetKeyInUse', () => {
  const BASE = 'https://amzn-s3-icon-assets.s3.ap-south-1.amazonaws.com';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_REGION = 'ap-south-1';
    process.env.S3_BUCKET = 'amzn-s3-icon-assets';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'test';
    process.env.S3_PUBLIC_BASE = BASE;
  });

  it('returns true when another hero references the same URL', async () => {
    (prisma.heroBanner.findFirst as jest.Mock).mockResolvedValue({ id: 'other-id' });
    const key = 'hero/2025/10/15/uuid-banner.png';
    const inUse = await isAssetKeyInUse(key, { heroId: 'current-id' });
    expect(inUse).toBe(true);
    const expectedUrl = `${BASE}/${key}`;
    expect(prisma.heroBanner.findFirst).toHaveBeenCalledWith({ where: { imageUrl: expectedUrl, NOT: { id: 'current-id' } } });
  });

  it('returns false when no other hero references the URL', async () => {
    (prisma.heroBanner.findFirst as jest.Mock).mockResolvedValue(null);
    const key = 'hero/2025/10/15/uuid-banner.png';
    const inUse = await isAssetKeyInUse(key, { heroId: 'current-id' });
    expect(inUse).toBe(false);
  });
});