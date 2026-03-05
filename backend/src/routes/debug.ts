import { Router, Request, Response } from 'express';
import { getRecentLogs } from '../utils/logger.js';
import { runAmiCommand } from '../services/ami.js';
import pool from '../config/db.js';

const router = Router();

router.get('/logs', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '200', 10);
  const logs = getRecentLogs(Number.isNaN(limit) ? 200 : limit);
  res.json({ logs });
});

router.get('/asterisk', async (_req: Request, res: Response) => {
  try {
    const [channels, pjsip, queues] = await Promise.all([
      runAmiCommand('core show channels').catch((e: Error) => `Hata: ${e.message}`),
      runAmiCommand('pjsip show endpoints like 10').catch((e: Error) => `Hata: ${e.message}`),
      runAmiCommand('queue show cc-support').catch((e: Error) => `Hata: ${e.message}`),
    ]);
    res.json({ channels, pjsip, queues });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message || 'Sunucu hatası' });
  }
});

router.get('/call-health', async (req: Request, res: Response) => {
  try {
    const agent = String(req.query.agent || '').trim();
    const params: string[] = [];
    let where = `WHERE c.status IN ('initiating', 'ringing', 'connected')`;
    if (agent) {
      params.push(agent);
      where += ` AND (u.username = $1 OR u.extension = $1)`;
    }

    const activeCalls = (
      await pool.query(
        `SELECT c.id, c.status, c.started_at, c.destination_number, c.hangup_cause,
                u.username AS agent_username, u.extension AS agent_extension
         FROM calls c
         LEFT JOIN users u ON c.agent_id = u.id
         ${where}
         ORDER BY c.started_at DESC NULLS LAST
         LIMIT 50`,
        params
      )
    ).rows;

    const [channels, contacts] = await Promise.all([
      runAmiCommand('core show channels concise').catch((e: Error) => `Hata: ${e.message}`),
      runAmiCommand('pjsip show contacts').catch((e: Error) => `Hata: ${e.message}`),
    ]);

    res.json({
      now: new Date().toISOString(),
      active_calls: activeCalls,
      channels,
      contacts,
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message || 'Sunucu hatası' });
  }
});

export default router;

