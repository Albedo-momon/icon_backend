import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { AwsCredentialIdentity } from '@aws-sdk/types';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

type Section = 'hero' | 'special' | 'laptop';

type S3Env = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
};

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return val;
}

function getS3Env(): S3Env {
  return {
    region: requireEnv('S3_REGION'),
    bucket: requireEnv('S3_BUCKET'),
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    publicBase: requireEnv('S3_PUBLIC_BASE'),
  };
}

const env = (() => {
  try {
    return getS3Env();
  } catch (err) {
    // Defer throwing until use; allow module load in non-upload contexts
    return null;
  }
})();

const baseConfig: { region: string } & Partial<{ credentials: AwsCredentialIdentity }> = {
  region: env?.region || 'us-east-1',
};
if (env) {
  baseConfig.credentials = { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey };
}
export const s3 = new S3Client(baseConfig);

export function buildObjectKey(section: Section, filename: string): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const sanitized = sanitizeFilename(filename);
  const uuid = randomUUID();
  return `${section}/${yyyy}/${mm}/${dd}/${uuid}-${sanitized}`;
}

export function sanitizeFilename(filename: string): string {
  // Lowercase, replace spaces with dashes, remove unsafe characters, keep extension
  const trimmed = filename.trim().toLowerCase();
  const parts = trimmed.split('.');
  const ext = parts.length > 1 ? parts.pop()! : '';
  const base = parts.join('.')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
  const safeBase = base.replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return ext ? `${safeBase}.${ext}` : safeBase;
}

export async function presignPutUrl({
  key,
  contentType,
  expiresInSec,
}: { key: string; contentType: string; expiresInSec: number }): Promise<string> {
  const cfg = env ?? getS3Env();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSec });
}

export function getS3PublicBase(): string {
  const cfg = env ?? getS3Env();
  return cfg.publicBase;
}