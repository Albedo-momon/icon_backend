import { Router } from 'express';
import { authConfig } from '../config/auth';
import { getAuthMode } from '../config/authMode';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { formatError, formatZodError } from '../utils/errors';
import { userRegisterSchema, userLoginSchema, adminRegisterSchema, adminLoginSchema } from '../validation/schemas';
import { hashPassword, verifyPassword, signNativeJwt } from '../middleware/native';

const router = Router();

function clerkOnly(res: any) {
  return res.status(405).json(formatError('METHOD_NOT_ALLOWED', 'Use Clerk client SDK'));
}

// Temporary visibility to confirm mode during requests
router.use((req, _res, next) => {
  const mode = getAuthMode();
  logger.debug({ mode, path: req.path, method: req.method }, 'auth:router:init');
  next();
});

// User Register
router.post('/auth/user/register', async (req, res) => {
  if (getAuthMode() === 'clerk') return clerkOnly(res);
  const parsed = userRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const { email, password, name } = parsed.data;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json(formatError('EMAIL_EXISTS', 'Email already registered'));
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, name: name ?? null, passwordHash, role: 'USER' } });
    const token = signNativeJwt({ uid: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    logger.error({ error }, 'User register failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to register'));
  }
});

// User Login
router.post('/auth/user/login', async (req, res) => {
  if (getAuthMode() === 'clerk') return clerkOnly(res);
  const parsed = userLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const { email, password } = parsed.data;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json(formatError('INVALID_CREDENTIALS', 'Invalid email or password'));
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json(formatError('INVALID_CREDENTIALS', 'Invalid email or password'));
    const token = signNativeJwt({ uid: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    logger.error({ error }, 'User login failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to login'));
  }
});

// Admin Register
router.post('/auth/admin/register', async (req, res) => {
  if (getAuthMode() === 'clerk') return clerkOnly(res);
  const parsed = adminRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const { email, password, name, secret } = parsed.data;
  try {
    if (secret !== authConfig.adminBootstrapSecret) {
      return res.status(403).json(formatError('FORBIDDEN', 'Invalid bootstrap secret'));
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json(formatError('EMAIL_EXISTS', 'Email already registered'));
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, name: name ?? null, passwordHash, role: 'ADMIN' } });
    const token = signNativeJwt({ uid: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    logger.error({ error }, 'Admin register failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to register admin'));
  }
});

// Admin Login
router.post('/auth/admin/login', async (req, res) => {
  const mode = getAuthMode();
  // Controller entry checkpoint
  (req as any).log?.debug({ mode }, 'auth:enter');
  if (mode === 'clerk') return clerkOnly(res);
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(formatZodError(parsed.error));
  const { email, password } = parsed.data;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
      (req as any).log?.warn({ email }, 'auth:native:login_failed');
      return res.status(401).json(formatError('INVALID_CREDENTIALS', 'Invalid admin credentials'));
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      (req as any).log?.warn({ email }, 'auth:native:login_failed');
      return res.status(401).json(formatError('INVALID_CREDENTIALS', 'Invalid admin credentials'));
    }
    const token = signNativeJwt({ uid: user.id, email: user.email, role: user.role });
    (req as any).log?.info({ userId: user.id }, 'auth:native:login_success');
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    logger.error({ error }, 'Admin login failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to login admin'));
  }
});

export default router;