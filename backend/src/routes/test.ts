import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { getExtensionSockets } from '../services/ami.js';
import { getIo } from '../socket.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.post('/screen-pop', async (req: Request, res: Response) => {
  try {
    const { callerId, extension, callback_url } = req.body as { callerId?: string; extension?: string; callback_url?: string };
    if (!callerId || !extension) {
      return res.status(400).json({ message: 'callerId and extension required' });
    }
    const io = getIo();
    if (!io) return res.status(500).json({ message: 'Socket.io not ready' });

    let customer: Record<string, unknown> | null = null;
    const normalized = String(callerId).replace(/\D/g, '').slice(-10);
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, phone_number, notes, debt_amount, last_payment_date, file_number 
       FROM customers 
       WHERE REPLACE(REPLACE(phone_number, ' ', ''), '+', '') LIKE $1 LIMIT 1`,
      [`%${normalized}`]
    );
    customer = (rows[0] as Record<string, unknown>) ?? null;

    const sockets = getExtensionSockets();
    const socketIds = sockets.get(extension);
    if (socketIds?.size) {
      let callId: string | null = null;
      const agent = (await pool.query<{ id: string }>('SELECT id FROM users WHERE extension = $1', [extension])).rows[0];
      if (agent) {
        callId = uuidv4();
        await pool.query(
          `INSERT INTO calls (id, agent_id, caller_number, direction, status, asterisk_uniqueid)
           VALUES ($1, $2, $3, 'inbound', 'ringing', $4)`,
          [callId, agent.id, callerId, 'test-' + Date.now()]
        );
      }
      const uniqueId = 'test-' + Date.now();
      socketIds.forEach((id) => {
        io.to(id).emit('SCREEN_POP', { callerId, uniqueId, customer, call_id: callId, callback_url: callback_url ?? null });
      });
      return res.json({ ok: true, customer: !!customer, call_id: callId });
    }
    res.status(404).json({ message: 'No agent with extension ' + extension + ' connected' });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
