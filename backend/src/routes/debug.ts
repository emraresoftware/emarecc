import { Router, Request, Response } from 'express';
import { getRecentLogs } from '../utils/logger.js';
import { runAmiCommand } from '../services/ami.js';
import pool from '../config/db.js';
import { readFileSync, statSync, existsSync, openSync, readSync, closeSync } from 'fs';

const router = Router();

/* ─── Asterisk log dosyasını oku (son N satır) ─── */
function readLastLines(filePath: string, maxLines: number): string[] {
  try {
    if (!existsSync(filePath)) return [];
    const stat = statSync(filePath);
    // Dosya çok büyükse sadece son kısmını oku (512KB)
    const readSize = Math.min(stat.size, 512 * 1024);
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    closeSync(fd);
    const lines = buf.toString('utf-8').split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch (e) {
    return [`Dosya okunamadı: ${(e as Error).message}`];
  }
}

/* ─── Asterisk log satırını parse et ─── */
const AST_LOG_RE = /^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+(\w+)\[(\d+)\](?:\[([^\]]*)\])?\s+(\S+?):\s*(.*)$/;
function parseAstLogLine(line: string): Record<string, string> {
  const m = AST_LOG_RE.exec(line);
  if (m) {
    return {
      ts: m[1],
      level: m[2],
      tid: m[3],
      callId: m[4] || '',
      module: m[5],
      msg: m[6],
    };
  }
  return { ts: '', level: '', tid: '', callId: '', module: '', msg: line };
}

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

/* ✅ Asterisk log dosyasını canlı oku */
router.get('/asterisk-logs', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '300', 10), 1000);
  const logFile = req.query.file === 'messages'
    ? '/var/log/asterisk/messages'
    : '/var/log/asterisk/full';
  const filter = ((req.query.filter as string) || '').toLowerCase();

  let lines = readLastLines(logFile, limit * 2); // fazladan oku, filtreden sonra kes

  // Filtrele
  if (filter) {
    lines = lines.filter((l) => l.toLowerCase().includes(filter));
  }

  // Son N satır
  lines = lines.slice(-limit);

  const parsed = lines.map(parseAstLogLine);
  res.json({ logs: parsed, total: parsed.length, file: logFile });
});

export default router;

