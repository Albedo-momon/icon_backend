import { Router } from 'express';

const router = Router();

// Dev-only: expose minimal env for debugging (no secrets)
router.get('/__debug/env', (_req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV || null,
    AUTH_MODE: (process.env.AUTH_MODE || '').trim() || null,
  });
});

export default router;