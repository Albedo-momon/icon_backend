import 'express-serve-static-core';

declare global {
  namespace Express {
    type AppRole = 'USER' | 'AGENT' | 'ADMIN';
    interface AuthUser {
      id: string;
      email: string;
      role: AppRole;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};