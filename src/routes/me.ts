import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  return res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
});

export default router;