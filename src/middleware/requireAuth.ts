import type { Request, Response, NextFunction } from 'express';
import { getAuthMode } from '../config/authMode';
import { requireAuthClerk } from './clerk';
import { requireAuthNative } from './native';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (getAuthMode() === 'clerk') {
    return requireAuthClerk(req, res, next);
  }
  return requireAuthNative(req, res, next);
}