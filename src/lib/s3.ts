import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

export function isS3Configured(): boolean {
  try {
    const cfg = env ?? getS3Env();
    return Boolean(cfg.region && cfg.bucket && cfg.publicBase);
  } catch {
    return false;
  }
}

export async function deleteObjectKey(key: string): Promise<void> {
  const cfg = env ?? getS3Env();
  const command = new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key });
  await s3.send(command);
}

export async function deleteObjectKeyWithRetry(
  key: string,
  opts: { timeoutMs?: number; maxAttempts?: number; onAttempt?: (info: { attempt: number; success: boolean; err?: any }) => void } = {}
): Promise<{ ok: boolean; attempts: number; error?: Error }> {
  const cfg = env ?? getS3Env();
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 3000);
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);

  let attempts = 0;
  let lastError: any;
  for (let i = 0; i < maxAttempts; i++) {
    attempts = i + 1;
    const command = new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      await s3.send(command, { abortSignal: ac.signal });
      clearTimeout(timer);
      opts.onAttempt?.({ attempt: attempts, success: true });
      return { ok: true, attempts };
    } catch (err: any) {
      clearTimeout(timer);
      // Treat NoSuchKey as success (S3 delete is idempotent and often returns 204 anyway)
      const code = err?.name || err?.code || '';
      if (String(code) === 'NoSuchKey') {
        opts.onAttempt?.({ attempt: attempts, success: true });
        return { ok: true, attempts };
      }
      lastError = err;
      opts.onAttempt?.({ attempt: attempts, success: false, err });
      // Backoff before retry: 200ms, 400ms, 800ms
      const delayMs = 200 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { ok: false, attempts, error: lastError };
}