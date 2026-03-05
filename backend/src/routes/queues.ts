import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM queues ORDER BY name');
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { name, strategy } = req.body as { name?: string; strategy?: string };
    if (!name) return res.status(400).json({ message: 'name required' });
    const { rows } = await pool.query(
      'INSERT INTO queues (name, strategy) VALUES ($1, $2) RETURNING *',
      [name, strategy ?? 'ring-all']
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { name, strategy } = req.body as { name?: string; strategy?: string };
    const updates: string[] = [];
    const params: (string | undefined)[] = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }
    if (strategy !== undefined) { updates.push(`strategy = $${i++}`); params.push(strategy); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE queues SET ${updates.join(', ')} WHERE id = $${i}`, params);
    const { rows } = await pool.query('SELECT * FROM queues WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT qm.*, u.username, u.extension FROM queue_members qm
       JOIN users u ON qm.user_id = u.id
       WHERE qm.queue_id = $1 ORDER BY u.username`,
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/members', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body as { user_id?: string };
    if (!user_id) return res.status(400).json({ message: 'user_id required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO queue_members (id, queue_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (queue_id, user_id) DO NOTHING',
      [id, req.params.id, user_id]
    );
    const { rows } = await pool.query(
      'SELECT qm.*, u.username, u.extension FROM queue_members qm JOIN users u ON qm.user_id = u.id WHERE qm.queue_id = $1 AND qm.user_id = $2',
      [req.params.id, user_id]
    );
    res.status(201).json(rows[0] ?? { ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ message: 'Agent already in queue' });
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/members/:userId', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM queue_members WHERE queue_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM queues WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
