import type { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config/auth';
import { requireAuthClerk } from './clerk';
import { requireAuthNative } from './native';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (authConfig.isClerk()) {
    return requireAuthClerk(req, res, next);
  }
  return requireAuthNative(req, res, next);
}