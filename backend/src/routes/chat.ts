import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { getIo } from '../socket.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/widget/start', async (req: Request, res: Response) => {
  try {
    const { visitor_name, visitor_email } = req.body as { visitor_name?: string; visitor_email?: string };
    const id = uuidv4();
    const identifier = (req.headers['x-visitor-id'] as string) ?? uuidv4();
    await pool.query(
      'INSERT INTO chat_sessions (id, visitor_name, visitor_email, visitor_identifier, status) VALUES ($1, $2, $3, $4, $5)',
      [id, visitor_name ?? 'Ziyaretçi', visitor_email ?? null, identifier, 'waiting']
    );
    const { rows } = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [id]);
    getIo()?.emit('CHAT_NEW_SESSION', rows[0]);
    res.status(201).json({ ...(rows[0] as object), visitor_identifier: identifier });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/widget/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, content, direction, created_at FROM interactions WHERE chat_session_id = $1 AND type = $2 ORDER BY created_at ASC',
      [req.params.sessionId, 'CHAT']
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/widget/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { content } = req.body as { content?: string };
    const sessionId = req.params.sessionId;
    if (!content?.trim()) return res.status(400).json({ message: 'content required' });
    const { rows: sessions } = await pool.query('SELECT id FROM chat_sessions WHERE id = $1', [sessionId]);
    if (!sessions[0]) return res.status(404).json({ message: 'Session not found' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO interactions (id, chat_session_id, type, direction, content) VALUES ($1, $2, $3, $4, $5)',
      [id, sessionId, 'CHAT', 'inbound', content.trim()]
    );
    await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);
    const { rows } = await pool.query('SELECT * FROM interactions WHERE id = $1', [id]);
    getIo()?.emit('CHAT_MESSAGE', { ...(rows[0] as object), direction: 'inbound' });
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.use(authMiddleware);

router.get('/sessions', requireRole('admin', 'supervisor', 'agent'), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const user = req.user as { id: string; role: string };
    let q = `SELECT cs.*, u.username as agent_username
      FROM chat_sessions cs
      LEFT JOIN users u ON cs.assigned_agent_id = u.id WHERE 1=1`;
    const params: (string | undefined)[] = [];
    let i = 1;
    if (user.role === 'agent') {
      q += ` AND (cs.assigned_agent_id = $${i++} OR cs.assigned_agent_id IS NULL)`;
      params.push(user.id);
    }
    if (status) { params.push(status as string); q += ` AND cs.status = $${i++}`; }
    q += ' ORDER BY cs.updated_at DESC LIMIT 50';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/sessions', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const body = (req.body as { visitor_name?: string; assign_to_agent_id?: string }) || {};
    const { visitor_name, assign_to_agent_id } = body;
    const id = uuidv4();
    const user = req.user as { id: string };
    let assignedId = user.id;
    if (assign_to_agent_id?.trim()) {
      const agentRow = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [assign_to_agent_id.trim(), 'agent']);
      if (agentRow.rows[0]) assignedId = agentRow.rows[0].id;
    }
    await pool.query(
      'INSERT INTO chat_sessions (id, visitor_name, visitor_email, visitor_identifier, status, assigned_agent_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, visitor_name?.trim() || 'Sohbet (Lider)', null, 'manual-' + id, 'active', assignedId]
    );
    const { rows } = await pool.query('SELECT cs.*, u.username as agent_username FROM chat_sessions cs LEFT JOIN users u ON cs.assigned_agent_id = u.id WHERE cs.id = $1', [id]);
    getIo()?.emit('CHAT_NEW_SESSION', rows[0]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/sessions/:id', requireRole('admin', 'supervisor', 'agent'), async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; role: string };
    const { rows } = await pool.query('SELECT id, assigned_agent_id FROM chat_sessions WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    if (user.role === 'agent' && rows[0].assigned_agent_id !== user.id) {
      return res.status(403).json({ message: 'Bu sohbeti silme yetkiniz yok' });
    }
    await pool.query('DELETE FROM interactions WHERE chat_session_id = $1', [req.params.id]);
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [req.params.id]);
    getIo()?.emit('CHAT_SESSION_DELETED', { sessionId: req.params.id });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/sessions/clear-all', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM interactions WHERE type = $1', ['CHAT']);
    const { rows } = await pool.query('SELECT id FROM chat_sessions');
    await pool.query('DELETE FROM chat_sessions');
    for (const r of rows) getIo()?.emit('CHAT_SESSION_DELETED', { sessionId: r.id });
    res.json({ message: 'Tüm sohbetler temizlendi', deleted: rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT cs.*, u.username as agent_username FROM chat_sessions cs LEFT JOIN users u ON cs.assigned_agent_id = u.id WHERE cs.id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.username as agent_username FROM interactions i
       LEFT JOIN users u ON i.agent_id = u.id
       WHERE i.chat_session_id = $1 AND i.type = 'CHAT'
       ORDER BY i.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/sessions/:id/assign', requireRole('admin', 'supervisor', 'agent'), async (req: Request, res: Response) => {
  try {
    const agentId = (req.body as { agent_id?: string })?.agent_id ?? req.user!.id;
    await pool.query(
      'UPDATE chat_sessions SET assigned_agent_id = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [agentId, 'active', req.params.id]
    );
    const { rows } = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    getIo()?.emit('CHAT_ASSIGNED', { sessionId: req.params.id, agentId });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/sessions/:id/messages', requireRole('admin', 'supervisor', 'agent'), async (req: Request, res: Response) => {
  try {
    const { content } = req.body as { content?: string };
    const agentId = req.user!.id;
    if (!content?.trim()) return res.status(400).json({ message: 'content required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO interactions (id, chat_session_id, type, direction, content, agent_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.params.id, 'CHAT', 'outbound', content.trim(), agentId]
    );
    await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    const { rows } = await pool.query('SELECT i.*, u.username as agent_username FROM interactions i LEFT JOIN users u ON i.agent_id = u.id WHERE i.id = $1', [id]);
    const msg = { ...(rows[0] as object), chat_session_id: req.params.id };
    getIo()?.emit('CHAT_MESSAGE', msg);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
