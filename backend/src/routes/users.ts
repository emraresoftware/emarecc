import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate, userCreateSchema } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);

// 1000-1010 arası dahili numaralar (admin eklerken seçebilsin)
const MIN_EXT = 1000;
const MAX_EXT = 1010;

router.get('/extensions', requireRole('admin', 'supervisor'), async (_req: Request, res: Response) => {
  try {
    const all = Array.from({ length: MAX_EXT - MIN_EXT + 1 }, (_, i) => String(MIN_EXT + i));
    const { rows } = await pool.query<{ extension: string }>(
      'SELECT extension FROM users WHERE extension IS NOT NULL AND extension BETWEEN $1 AND $2',
      [String(MIN_EXT), String(MAX_EXT)]
    );
    const used = rows.map((r) => r.extension);
    const available = all.filter((ext) => !used.includes(ext));
    res.json({ all, used, available });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { role, status } = req.query;
    let q = 'SELECT id, username, extension, role, status, created_at FROM users WHERE 1=1';
    const params: (string | undefined)[] = [];
    let i = 1;
    if (role) { q += ` AND role = $${i++}`; params.push(role as string); }
    if (status) { q += ` AND status = $${i++}`; params.push(status as string); }
    q += ' ORDER BY username';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireRole('admin'), validate(userCreateSchema), async (req: Request, res: Response) => {
  try {
    const v = req.validated as { username: string; password: string; extension?: string; role?: string };
    const { username, password, extension, role } = v;
    if (extension && (isNaN(Number(extension)) || Number(extension) < MIN_EXT || Number(extension) > MAX_EXT)) {
      return res.status(400).json({ message: `Extension ${extension} izin verilen aralıkta değil (${MIN_EXT}-${MAX_EXT}).` });
    }
    if (extension) {
      const exists = await pool.query('SELECT 1 FROM users WHERE extension = $1', [extension]);
      if (exists.rowCount) {
        return res.status(409).json({ message: `Extension ${extension} başka bir kullanıcıya atanmış.` });
      }
    }
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const effectiveRole = role ?? 'agent';
    const initialStatus = effectiveRole === 'agent' ? 'ready' : 'offline';
    await pool.query(
      'INSERT INTO users (id, username, password_hash, extension, role, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, hash, extension ?? null, effectiveRole, initialStatus]
    );
    const { rows } = await pool.query('SELECT id, username, extension, role, status FROM users WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') {
      if (e.constraint?.includes('users_username')) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      if (e.constraint?.includes('users_extension')) {
        return res.status(409).json({ message: 'Extension already in use' });
      }
    }
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { username, password, extension, role } = req.body as { username?: string; password?: string; extension?: string; role?: string };
    const userId = req.params.id;
    const updates: string[] = [];
    const params: (string | undefined)[] = [];
    let i = 1;
    if (username !== undefined) { updates.push(`username = $${i++}`); params.push(username); }
    if (extension !== undefined) {
      if (extension && (isNaN(Number(extension)) || Number(extension) < MIN_EXT || Number(extension) > MAX_EXT)) {
        return res.status(400).json({ message: `Extension ${extension} izin verilen aralıkta değil (${MIN_EXT}-${MAX_EXT}).` });
      }
      if (extension) {
        const exists = await pool.query('SELECT 1 FROM users WHERE extension = $1 AND id <> $2', [extension, userId]);
        if (exists.rowCount) {
          return res.status(409).json({ message: `Extension ${extension} başka bir kullanıcıya atanmış.` });
        }
      }
      updates.push(`extension = $${i++}`);
      params.push(extension ?? null);
    }
    if (role !== undefined) { updates.push(`role = $${i++}`); params.push(role); }
    if (password && String(password).trim()) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${i++}`);
      params.push(hash);
    }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
    const { rows } = await pool.query('SELECT id, username, extension, role, status FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') {
      if (e.constraint?.includes('users_username')) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      if (e.constraint?.includes('users_extension')) {
        return res.status(409).json({ message: 'Extension already in use' });
      }
    }
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !['ready', 'paused', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const allowSelf = req.params.id === req.user!.id;
    const allowOther = ['admin', 'supervisor'].includes(req.user!.role);
    if (!allowSelf && !allowOther) return res.status(403).json({ message: 'Forbidden' });
    await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    const { rows } = await pool.query('SELECT id, username, extension, role, status FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
