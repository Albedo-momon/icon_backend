import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/rbac';
import { formatError, formatZodError } from '../utils/errors';
import { PresignBodySchema, validateContentType } from '../validation/uploads';
import { buildObjectKey, presignPutUrl, getS3PublicBase } from '../lib/s3';
import { logger } from '../config/logger';

const router = Router();

router.post('/presign', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const parsed = PresignBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const hasContentTypeIssue = parsed.error.issues.some((i) => i.path.join('.') === 'contentType');
    const status = hasContentTypeIssue ? 415 : 400;
    return res.status(status).json(formatZodError(parsed.error));
  }

  const { section, filename, contentType } = parsed.data;
  if (!validateContentType(contentType)) {
    return res.status(415).json(formatError('UNSUPPORTED_MEDIA_TYPE', 'Content type not allowed'));
  }

  try {
    const key = buildObjectKey(section, filename);
    const expiresIn = 300;
    const uploadUrl = await presignPutUrl({ key, contentType, expiresInSec: expiresIn });
    const publicUrl = `${getS3PublicBase()}/${key}`;
    return res.json({ uploadUrl, publicUrl, key, expiresIn });
  } catch (error: any) {
    logger.error({ error }, 'Presign upload failed');
    const msg = typeof error?.message === 'string' && error.message.includes('Missing environment variable')
      ? 'S3 configuration missing'
      : 'Failed to presign upload';
    const code = typeof error?.message === 'string' && error.message.includes('Missing environment variable')
      ? 'MISSING_ENV'
      : 'INTERNAL_ERROR';
    return res.status(500).json(formatError(code, msg));
  }
});

export default router;