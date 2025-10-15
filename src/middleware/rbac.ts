import type { Request, Response, NextFunction } from 'express';

type Role = 'USER' | 'AGENT' | 'ADMIN';

export function requireRole(required: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    const hierarchy: Record<Role, number> = { USER: 1, AGENT: 2, ADMIN: 3 };
    if (hierarchy[role] < hierarchy[required]) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}