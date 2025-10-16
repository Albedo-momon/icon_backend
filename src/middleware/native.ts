import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { authConfig } from '../config/auth';
import { getAuthMode } from '../config/authMode';

const jwtSecret = authConfig.jwtSecret;

export async function requireAuthNative(req: Request, res: Response, next: NextFunction) {
  try {
    if (getAuthMode() !== 'native') return res.status(500).json({ error: 'Native auth disabled' });

    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured for native auth');
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      logger.warn({ err }, 'Native JWT verification failed');
      return res.status(401).json({ error: 'Invalid token' });
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
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: user.id, email: user.email, role: user.role as any };
    return next();
  } catch (error) {
    logger.error({ error }, 'Native auth error');
    return res.status(500).json({ error: 'Auth error' });
  }
}

// Utility helpers for native mode (potentially used by register/login endpoints)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signNativeJwt(payload: Record<string, any>, expiresIn: string | number = '7d'): string {
  const options: SignOptions = { algorithm: 'HS256', expiresIn: expiresIn as any };
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(payload, jwtSecret as Secret, options);
}