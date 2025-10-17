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

// Handshake route for explicit user upsert (both mobile and admin clients)
router.post('/auth/handshake', async (req, res): Promise<void> => {
  const mode = getAuthMode();
  (req as any).log?.debug({ mode }, 'auth:handshake:enter');

  if (mode === 'clerk') {
    // Clerk mode: verify JWT and perform idempotent upsert
    try {
      const auth = req.headers.authorization || '';
      const [scheme, token] = auth.split(' ');
      if (scheme !== 'Bearer' || !token) {
        res.status(401).json(formatError('UNAUTHORIZED', 'Missing Bearer token'));
        return;
      }

      // Use the same JWT verification logic as requireAuthClerk
      const jwt = require('jsonwebtoken');
      const jwksClient = require('jwks-rsa');
      const { authConfig } = require('../config/auth');

      const jwksUri = authConfig.clerkJwksUrl;
      if (!jwksUri) {
        res.status(500).json(formatError('INTERNAL_ERROR', 'JWKS URL not configured'));
        return;
      }

      const client = jwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 10,
        cacheMaxAge: 60 * 60 * 1000,
        rateLimit: true,
      });

      function getKey(header: any, callback: any) {
        if (!header.kid) {
          return callback(new Error('kid missing'));
        }
        client.getSigningKey(header.kid, (err: any, key: any) => {
          if (err) return callback(err);
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        });
      }

      // Allow small clock skew to avoid NotBeforeError when token nbf is slightly ahead
      jwt.verify(token, getKey, { algorithms: ['RS256'], clockTolerance: 5 }, async (err: any, decoded: any) => {
        if (err || !decoded || typeof decoded !== 'object') {
          if (err?.name === 'NotBeforeError') {
            logger.warn({ err }, 'Handshake JWT verification failed: not active yet (nbf skew)');
          } else {
            logger.warn({ err }, 'Handshake JWT verification failed');
          }
          return res.status(401).json(formatError('INVALID_TOKEN', 'Invalid token'));
        }

        let email = decoded.email as string | undefined;
        let name = decoded.name as string | undefined;
        const externalId = decoded.sub as string | undefined;

        if (!externalId) {
          return res.status(401).json(formatError('MISSING_CLAIMS', 'Missing required claims'));
        }

        // Fallback: fetch email/name from Clerk if not present in JWT
        if (!email) {
          try {
            const { fetchClerkUserInfo } = await import('../lib/clerk');
            const info = await fetchClerkUserInfo(externalId);
            if (info) {
              email = info.email ?? email;
              name = info.name ?? name;
            }
          } catch (e) {
            logger.warn({ e }, 'Failed to load Clerk helper');
          }
        }

        if (!email) {
          return res.status(401).json(formatError('MISSING_CLAIMS', 'Missing required claims'));
        }

        // Idempotent upsert: try by externalId, else by email, else create
        let user = await prisma.user.findUnique({ where: { externalId } });
        if (!user) {
          const byEmail = await prisma.user.findUnique({ where: { email } });
          if (byEmail) {
            // Update existing user with externalId and name, but preserve role
            user = await prisma.user.update({ 
              where: { email }, 
              data: { 
                externalId, 
                name: name ?? byEmail.name ?? byEmail.email 
              } 
            });
          } else {
            // Create new user with default USER role
            user = await prisma.user.create({
              data: {
                externalId,
                email,
                name: name ?? email,
                role: 'USER',
              },
            });
          }
        } else {
          // Update existing user's email/name without changing role
          user = await prisma.user.update({
            where: { externalId },
            data: {
              email,
              name: name ?? user.name ?? email,
            },
          });
        }

        (req as any).log?.info({ userId: user.id, role: user.role }, 'auth:handshake:clerk:success');
        res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
          }
        });
        return;
      });
    } catch (error) {
      logger.error({ error }, 'Handshake Clerk error');
      res.status(500).json(formatError('INTERNAL_ERROR', 'Handshake failed'));
      return;
    }
   } else {
     // Native mode: verify JWT and return user info
     try {
       const auth = req.headers.authorization || '';
       const [scheme, token] = auth.split(' ');
       if (scheme !== 'Bearer' || !token) {
         res.status(401).json(formatError('UNAUTHORIZED', 'Missing Bearer token'));
         return;
       }

       if (!authConfig.jwtSecret) {
         res.status(500).json(formatError('INTERNAL_ERROR', 'JWT_SECRET not configured'));
         return;
       }

        const jwt = require('jsonwebtoken');
        let decoded: any;
        try {
          decoded = jwt.verify(token, authConfig.jwtSecret, { algorithms: ['HS256'] });
        } catch (err) {
          logger.warn({ err }, 'Native handshake JWT verification failed');
         res.status(401).json(formatError('INVALID_TOKEN', 'Invalid token'));
         return;
        }

       const userId = decoded.uid || decoded.sub;
       const email = decoded.email as string | undefined;

       let user = null;
       if (userId) {
         user = await prisma.user.findUnique({ where: { id: userId } });
       }
       if (!user && email) {
         user = await prisma.user.findUnique({ where: { email } });
       }

       if (!user) {
         res.status(401).json(formatError('USER_NOT_FOUND', 'User not found'));
         return;
         }

        (req as any).log?.info({ userId: user.id, role: user.role }, 'auth:handshake:native:success');
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        }
      });
      return;
     } catch (error) {
       logger.error({ error }, 'Handshake native error');
      res.status(500).json(formatError('INTERNAL_ERROR', 'Handshake failed'));
      return;
     }
   }
 });

 export default router;