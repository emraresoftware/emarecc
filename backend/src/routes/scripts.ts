import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM scripts ORDER BY name');
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/default', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM scripts WHERE is_default = true LIMIT 1');
    res.json(rows[0] ?? null);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, content, is_default } = req.body as { name?: string; content?: string; is_default?: boolean };
    if (!name || !content) return res.status(400).json({ message: 'name and content required' });
    if (is_default) {
      await pool.query('UPDATE scripts SET is_default = false');
    }
    const id = uuidv4();
    await pool.query(
      'INSERT INTO scripts (id, name, content, is_default) VALUES ($1, $2, $3, $4)',
      [id, name, content, !!is_default]
    );
    const { rows } = await pool.query('SELECT * FROM scripts WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, content, is_default } = req.body as { name?: string; content?: string; is_default?: boolean };
    const updates: string[] = [];
    const params: (string | boolean | undefined)[] = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }
    if (content !== undefined) { updates.push(`content = $${i++}`); params.push(content); }
    if (is_default !== undefined) {
      if (is_default) await pool.query('UPDATE scripts SET is_default = false');
      updates.push(`is_default = $${i++}`);
      params.push(!!is_default);
    }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE scripts SET ${updates.join(', ')} WHERE id = $${i}`, params);
    const { rows } = await pool.query('SELECT * FROM scripts WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM scripts WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export interface ScriptCustomer {
  first_name?: string;
  last_name?: string;
  debt_amount?: number | string;
  file_number?: string;
  last_payment_date?: string;
}

export function fillScriptPlaceholders(content: string, customer: ScriptCustomer = {}): string {
  if (!content) return '';
  return content
    .replace(/\{\{first_name\}\}/g, String(customer.first_name ?? ''))
    .replace(/\{\{last_name\}\}/g, String(customer.last_name ?? ''))
    .replace(/\{\{debt_amount\}\}/g, String(customer.debt_amount ?? ''))
    .replace(/\{\{file_number\}\}/g, String(customer.file_number ?? ''))
    .replace(/\{\{last_payment_date\}\}/g, String(customer.last_payment_date ?? ''));
}

export default router;
