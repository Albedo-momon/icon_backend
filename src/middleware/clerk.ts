import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtHeader } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { authConfig } from '../config/auth';
import { fetchClerkUserInfo } from '../lib/clerk';

const jwksUri = authConfig.clerkJwksUrl;
if (authConfig.isClerk() && !jwksUri) {
  logger.warn('CLERK_JWKS_URL is not set. Clerk auth will fail.');
}

const client = jwksUri
  ? jwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 60 * 60 * 1000, // 1 hour
      rateLimit: true,
    })
  : null;

function getKey(header: JwtHeader, callback: (err: Error | null, key?: string) => void) {
  if (!client || !header.kid) {
    return callback(new Error('JWKS client not configured or kid missing'));
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const requireAuthClerk: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!authConfig.isClerk()) return res.status(500).json({ error: 'Clerk auth disabled' });
    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    // Allow small clock skew to avoid NotBeforeError when token nbf is a fraction ahead
    return jwt.verify(token, getKey, { algorithms: ['RS256'], clockTolerance: 5 }, async (err, decoded) => {
      if (err || !decoded || typeof decoded !== 'object') {
        if ((err as any)?.name === 'NotBeforeError') {
          logger.warn({ err }, 'JWT verification failed: not active yet (nbf skew)');
        } else {
          logger.warn({ err }, 'JWT verification failed');
        }
        return res.status(401).json({ error: 'Invalid token' });
      }

      let email = (decoded as any).email as string | undefined;
      let name = (decoded as any).name as string | undefined;
      const externalId = (decoded as any).sub as string | undefined;

      if (!externalId) {
        return res.status(401).json({ error: 'Missing required claims' });
      }

      // Fallback: fetch email/name from Clerk if not present in JWT
      if (!email) {
        const info = await fetchClerkUserInfo(externalId);
        if (info) {
          email = info.email ?? email;
          name = info.name ?? name;
        }
      }

      if (!email) {
        return res.status(401).json({ error: 'Missing required claims' });
      }

      // Upsert user: try by externalId, else by email, else create
      let user = await prisma.user.findUnique({ where: { externalId } });
      if (!user) {
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          user = await prisma.user.update({ where: { email }, data: { externalId, name: byEmail.name ?? name ?? byEmail.email } });
        } else {
          user = await prisma.user.create({
            data: {
              externalId,
              email,
              name: name ?? email,
              role: 'USER',
            },
          });
        }
      }

      req.user = { id: user.id, email: user.email, role: user.role as any };
      return next();
    });
  } catch (error) {
    logger.error({ error }, 'Clerk auth error');
    return res.status(500).json({ error: 'Auth error' });
  }
};