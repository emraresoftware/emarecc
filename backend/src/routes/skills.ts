import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/route', async (req: Request, res: Response) => {
  try {
    const token = process.env.SKILL_ROUTE_TOKEN;
    if (token && req.query.token !== token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const skill = (req.query.skill ?? '').toString().trim().toLowerCase();
    if (!skill) return res.status(400).json({ message: 'skill required' });

    const { rows } = await pool.query<{ extension: string }>(
      `SELECT u.extension FROM users u
       JOIN agent_skills ask ON ask.agent_id = u.id
       WHERE LOWER(ask.skill) = $1 AND u.role = 'agent' AND u.status = 'ready'
         AND u.extension IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.agent_id = u.id AND c.status IN ('ringing', 'connected', 'initiating'))
       ORDER BY ask.level DESC NULLS LAST
       LIMIT 1`,
      [skill]
    );
    if (rows[0]) return res.json({ extension: rows[0].extension });
    res.status(404).json({ message: 'No available agent with skill' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.use(authMiddleware);

router.get('/user/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, skill, level, created_at FROM agent_skills WHERE agent_id = $1 ORDER BY level DESC, skill',
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/user/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { skill, level } = req.body as { skill?: string; level?: string | number };
    if (!skill?.trim()) return res.status(400).json({ message: 'skill required' });
    const skillNorm = skill.trim().toLowerCase();
    const lvl = Math.max(1, Math.min(10, parseInt(String(level), 10) || 5));
    const existing = (await pool.query('SELECT * FROM agent_skills WHERE agent_id = $1 AND LOWER(skill) = $2', [req.params.id, skillNorm])).rows[0];
    if (existing) return res.status(409).json({ message: 'Skill already exists for agent' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO agent_skills (id, agent_id, skill, level) VALUES ($1, $2, $3, $4)',
      [id, req.params.id, skillNorm, lvl]
    );
    const { rows } = await pool.query('SELECT * FROM agent_skills WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/user/:id/:skillId', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM agent_skills WHERE id = $1 AND agent_id = $2',
      [req.params.skillId, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
