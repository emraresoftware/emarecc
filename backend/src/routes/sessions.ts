import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getSessions } from '../sessions.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin', 'supervisor'));

router.get('/', (_req: Request, res: Response) => {
  try {
    const sessions = getSessions();
    res.json({ sessions });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

export default router;
