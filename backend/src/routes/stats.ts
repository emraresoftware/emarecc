import { Router, Request, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/wallboard', async (req: Request, res: Response) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'Token required' });
  const envToken = process.env.WALLBOARD_PUBLIC_TOKEN;
  let valid = !!(envToken && token === envToken);
  if (!valid) {
    try {
      const { rows } = await pool.query<{ value: string }>("SELECT value FROM system_settings WHERE key = 'wallboard_public_token'");
      const dbToken = rows[0]?.value;
      valid = !!(dbToken && token === dbToken);
    } catch {
      /* ignore */
    }
  }
  if (!valid) return res.status(401).json({ message: 'Invalid or missing token' });

  try {
    const { rows } = await pool.query<{ ready: string; offline: string; paused: string }>(`
      SELECT COUNT(*) FILTER (WHERE status = 'ready') as ready,
        COUNT(*) FILTER (WHERE status = 'offline') as offline,
        COUNT(*) FILTER (WHERE status = 'paused') as paused
      FROM users WHERE role = 'agent'
    `);
    const r = rows[0];
    res.json({
      agents: { ready: parseInt(r?.ready ?? '0', 10) || 0, busy: 0, paused: parseInt(r?.paused ?? '0', 10) || 0 },
      queue_waiting: 0,
      avg_wait_time: 0,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.use(authMiddleware);

router.get('/realtime', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ ready: string; paused: string }>(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ready') as ready,
        COUNT(*) FILTER (WHERE status = 'offline') as offline,
        COUNT(*) FILTER (WHERE status = 'paused') as paused
      FROM users WHERE role = 'agent'
    `);
    const r = rows[0];
    res.json({
      agents: { ready: parseInt(r?.ready ?? '0', 10) || 0, busy: 0, paused: parseInt(r?.paused ?? '0', 10) || 0 },
      queue_waiting: 0,
      avg_wait_time: 0,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
