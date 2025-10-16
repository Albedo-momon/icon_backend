import { extractS3Key } from '../lib/assets';

describe('extractS3Key', () => {
  const BASE = 'https://amzn-s3-icon-assets.s3.ap-south-1.amazonaws.com';

  beforeEach(() => {
    process.env.S3_REGION = 'ap-south-1';
    process.env.S3_BUCKET = 'amzn-s3-icon-assets';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'test';
    process.env.S3_PUBLIC_BASE = BASE;
  });

  it('returns key for valid public URL', () => {
    const url = `${BASE}/hero/2025/10/15/uuid-banner.png`;
    expect(extractS3Key(url)).toBe('hero/2025/10/15/uuid-banner.png');
  });

  it('handles base with trailing slash', () => {
    process.env.S3_PUBLIC_BASE = `${BASE}/`;
    const url = `${BASE}/special/2025/10/15/uuid-offer.jpg`;
    expect(extractS3Key(url)).toBe('special/2025/10/15/uuid-offer.jpg');
  });

  it('returns null for non-bucket URL', () => {
    const other = `https://cdn.example.com/hero/2025/10/15/file.png`;
    expect(extractS3Key(other)).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(extractS3Key('')).toBeNull();
  });
});