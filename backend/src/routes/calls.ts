import { Router, Request, Response } from 'express';
import { createReadStream, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate, initiateCallSchema, transferCallSchema } from '../middleware/validate.js';
import {
  initiateOutbound,
  initiateChanSpy,
  getAgentChannelForCall,
  getChannelsForCall,
  runAmiCommand,
  hangupCall,
  blindTransfer,
  attendedTransfer,
} from '../services/ami.js';
import { setLastCallExtension } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);

router.post('/initiate', validate(initiateCallSchema), async (req: Request, res: Response) => {
  try {
    const v = req.validated as {
      extension: string;
      destination: string;
      customer_id?: string;
      external_id?: string;
      external_type?: string;
      callback_url?: string;
      webrtc_direct?: boolean;
    };
    const { extension, destination, customer_id, external_id, external_type, callback_url, webrtc_direct } = v;
    const dest = String(destination).replace(/\D/g, '');
    if (!dest) return res.status(400).json({ message: 'Invalid destination' });

    let agentId: string | undefined;
    if (req.user!.role === 'admin' || req.user!.role === 'supervisor') {
      const u = (await pool.query<{ id: string }>('SELECT id FROM users WHERE extension = $1', [String(extension)])).rows[0];
      agentId = u?.id;
    } else {
      const u = (await pool.query<{ id: string; extension: string | null }>('SELECT id, extension FROM users WHERE id = $1', [req.user!.id])).rows[0];
      if (!u || u.extension !== String(extension)) {
        return res.status(403).json({ message: 'Can only initiate from your own extension' });
      }
      agentId = u.id;
    }
    if (!agentId) return res.status(400).json({ message: 'Extension not found or not authorized' });

    await pool.query(
      `UPDATE calls
       SET status = 'failed',
           hangup_cause = COALESCE(hangup_cause, 'STALE_RINGING_TIMEOUT')
       WHERE agent_id = $1
         AND status IN ('ringing', 'initiating')
         AND started_at < NOW() - INTERVAL '35 seconds'`,
      [agentId]
    );

    const activeCall = (
      await pool.query<{ id: string }>(
        `SELECT id FROM calls
         WHERE agent_id = $1
           AND (
             status = 'connected'
             OR (status IN ('ringing', 'initiating') AND started_at > NOW() - INTERVAL '2 minutes')
           )
         ORDER BY COALESCE(started_at, NOW()) DESC
         LIMIT 1`,
        [agentId]
      )
    ).rows[0];
    if (activeCall) {
      let hasLiveChannel = true;
      try {
        const channels = await runAmiCommand('core show channels concise');
        const extPattern = new RegExp(`(^|\\n)(PJSIP|SIP)/${String(extension)}-`, 'i');
        hasLiveChannel = extPattern.test(channels);
      } catch {
        hasLiveChannel = true;
      }

      if (!hasLiveChannel) {
        await pool.query(
          `UPDATE calls
           SET status = 'failed',
               hangup_cause = COALESCE(hangup_cause, 'STALE_DB_ACTIVE_NO_CHANNEL')
           WHERE agent_id = $1
             AND status IN ('ringing', 'initiating', 'connected')`,
          [agentId]
        );
      } else {
        return res.status(409).json({ message: 'Bu dahili için zaten aktif bir çağrı var. Önce mevcut çağrıyı sonlandırın.' });
      }
    }

    const recentSameDestination = (
      await pool.query<{ id: string }>(
        `SELECT id FROM calls
         WHERE agent_id = $1
           AND destination_number = $2
           AND started_at > NOW() - INTERVAL '12 seconds'
         ORDER BY started_at DESC
         LIMIT 1`,
        [agentId, dest]
      )
    ).rows[0];

    if (recentSameDestination) {
      return res.status(429).json({
        message: 'Aynı numaraya çok hızlı tekrar arama engellendi. Lütfen birkaç saniye bekleyip tekrar deneyin.',
      });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO calls (id, agent_id, destination_number, direction, status, started_at, external_id, external_type, callback_url, customer_id)
       VALUES ($1, $2, $3, 'outbound', $8, NOW(), $4, $5, $6, $7)`,
      [id, agentId, dest, external_id ?? null, external_type ?? 'crm', callback_url ?? null, customer_id ?? null, webrtc_direct ? 'ringing' : 'initiating']
    );

    // WebRTC doğrudan arama: tarayıcı SIP INVITE gönderiyor, AMI Originate gerekmez
    if (webrtc_direct) {
      await setLastCallExtension(dest, String(extension));
      logger.info('WebRTC direct call record created', { callId: id, extension, destination: dest });
      const { rows } = await pool.query('SELECT * FROM calls WHERE id = $1', [id]);
      return res.status(201).json({ ...rows[0], ami_unique_id: null });
    }

    let uniqueId: string | null = null;
    let lastInitiateError: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        uniqueId = await initiateOutbound(String(extension), dest, customer_id ? { CUSTOMER_ID: customer_id } : {});
        lastInitiateError = null;
        break;
      } catch (amiErr) {
        const errMsg = (amiErr as Error).message ?? String(amiErr);
        const errDetail = (amiErr as { response?: string; message?: string })?.response ?? errMsg;
        lastInitiateError = errDetail || errMsg;

        const isRetryable = /originate failed|timeout|ami originate timeout|softphone\s+"bağlı"\s+olmalı/i.test(
          String(lastInitiateError)
        );

        if (attempt < 2 && isRetryable) {
          logger.warn('Initiate outbound transient failure, retrying once', {
            err: errMsg,
            detail: errDetail,
            extension,
            destination: dest,
            attempt,
          });
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }

        logger.error('Initiate outbound failed', { err: errMsg, detail: errDetail, extension, destination: dest, attempt });
        break;
      }
    }

    if (!uniqueId) {
      await pool.query(`UPDATE calls SET status = 'failed' WHERE id = $1`, [id]);
      return res.status(503).json({ message: lastInitiateError || 'Arama başlatılamadı' });
    }
    await setLastCallExtension(dest, String(extension));

    const normalizedUniqueId = String(uniqueId ?? '').trim();
    const asteriskUniqueId = /^\d+\.\d+$/.test(normalizedUniqueId) ? normalizedUniqueId : null;

    await pool.query(
      `UPDATE calls SET status = 'ringing', started_at = NOW(), asterisk_uniqueid = $2 WHERE id = $1`,
      [id, asteriskUniqueId]
    );
    const { rows } = await pool.query('SELECT * FROM calls WHERE id = $1', [id]);
    res.status(201).json({ ...rows[0], ami_unique_id: uniqueId });
  } catch (err) {
    logger.error('GET /calls failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me/active', async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; role: string };
    const userRow = (
      await pool.query<{ extension: string | null }>('SELECT extension FROM users WHERE id = $1', [user.id])
    ).rows[0];

    await pool.query(
      `UPDATE calls
       SET status = 'failed',
           hangup_cause = COALESCE(hangup_cause, 'STALE_ME_ACTIVE_TIMEOUT')
       WHERE agent_id = $1
         AND status IN ('ringing', 'initiating')
         AND started_at < NOW() - INTERVAL '35 seconds'`,
      [user.id]
    );

    const { rows } = await pool.query(
      `SELECT c.id, c.status, c.caller_number, c.destination_number, c.started_at
       FROM calls c 
       WHERE c.agent_id = $1 
         AND c.status IN ('ringing', 'connected', 'initiating')
         AND c.started_at > NOW() - INTERVAL '10 minutes'
       ORDER BY c.started_at DESC NULLS LAST LIMIT 1`,
      [user.id]
    );
    if (!rows[0]) return res.status(204).send();

    const extension = String(userRow?.extension || '').replace(/\D/g, '');
    if (extension && rows[0].status !== 'ringing') {
      // WebRTC direct aramalarda 'ringing' status'unu kontrol etme — 
      // kanal kontrolü sadece 'connected' veya 'initiating' durumlar için geçerli.
      // 'ringing' durumunda SIP.js kendi state'ini yönetiyor.
      let hasLiveChannel = true;
      try {
        const channels = await runAmiCommand('core show channels concise');
        const extPattern = new RegExp(`(^|\\n)(PJSIP|SIP)/${extension}-`, 'i');
        hasLiveChannel = extPattern.test(channels);
      } catch {
        hasLiveChannel = true;
      }

      if (!hasLiveChannel) {
        await pool.query(
          `UPDATE calls
           SET status = 'failed',
               hangup_cause = COALESCE(hangup_cause, 'ME_ACTIVE_NO_LIVE_CHANNEL')
           WHERE id = $1
             AND status IN ('connected', 'initiating')`,
          [rows[0].id]
        );
        return res.status(204).send();
      }
    }

    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/hangup', async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; role: string };
    const callId = req.params.id;
    const { rows } = await pool.query(
      'SELECT id, agent_id, status FROM calls WHERE id = $1 AND status IN ($2, $3, $4)',
      [callId, 'ringing', 'connected', 'initiating']
    );
    if (!rows[0]) return res.status(404).json({ message: 'Çağrı bulunamadı veya zaten bitmiş' });
    if (user.role === 'agent' && rows[0].agent_id !== user.id) {
      return res.status(403).json({ message: 'Bu çağrıyı sonlandırma yetkiniz yok' });
    }
    await hangupCall(callId);
    await pool.query(
      `UPDATE calls
       SET status = CASE WHEN status = 'connected' THEN 'ANSWERED' ELSE 'failed' END,
           hangup_cause = COALESCE(hangup_cause, 'MANUAL_HANGUP_REQUEST')
       WHERE id = $1
         AND status IN ('ringing', 'connected', 'initiating')`,
      [callId]
    );
    res.json({ message: 'Çağrı sonlandırıldı' });
  } catch (e) {
    const msg = (e as Error).message || 'Çağrı sonlandırılamadı';
    // Eğer kanal bulunamadıysa, Asterisk tarafında zaten bitmiş demektir; DB kaydını güncelle ve başarı dön.
    if (msg.includes('Çağrı kanalı bulunamadı')) {
      await pool.query("UPDATE calls SET status = 'failed' WHERE id = $1", [req.params.id]);
      return res.json({ message: 'Çağrı zaten bitmiş olarak işaretlendi' });
    }
    res.status(503).json({ message: msg });
  }
});

router.get('/active', requireRole('admin', 'supervisor'), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.username as agent_username, u.extension as agent_extension
       FROM calls c
       LEFT JOIN users u ON c.agent_id = u.id
       WHERE c.status IN ('ringing', 'connected', 'initiating')
       ORDER BY c.started_at DESC NULLS LAST
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    logger.error('GET /calls/active failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { from, to, agent_id, status, external_id, external_type } = req.query;
    const user = req.user as { id: string; role: string } | undefined;
    let q = `SELECT c.*, u.username as agent_username 
      FROM calls c 
      LEFT JOIN users u ON c.agent_id = u.id 
      WHERE 1=1`;
    const params: (string | undefined)[] = [];
    let i = 1;
    if (user?.role === 'agent') {
      q += ` AND c.agent_id = $${i++}`;
      params.push(user.id);
    } else if (agent_id) {
      q += ` AND c.agent_id = $${i++}`;
      params.push(agent_id as string);
    }
    if (from) { q += ` AND c.started_at >= $${i++}`; params.push(from as string); }
    if (to) { q += ` AND c.started_at <= $${i++}`; params.push(to as string); }
    if (status) { q += ` AND c.status = $${i++}`; params.push(status as string); }
    if (external_id) { q += ` AND c.external_id = $${i++}`; params.push(external_id as string); }
    if (external_type) { q += ` AND c.external_type = $${i++}`; params.push(external_type as string); }
    q += ' ORDER BY c.started_at DESC LIMIT 200';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    logger.error('GET /calls failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/recording', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ recording_path: string | null; asterisk_uniqueid: string | null }>(
      'SELECT recording_path, asterisk_uniqueid FROM calls WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    const recPath = rows[0].recording_path ?? rows[0].asterisk_uniqueid;
    if (!recPath) return res.status(404).json({ message: 'Recording not available' });

    const baseDir = process.env.RECORDINGS_PATH || '/recordings';
    if (!existsSync(baseDir)) return res.status(503).json({ message: 'Recordings storage not configured' });

    let filePath: string | null = null;
    const candidates = [
      join(baseDir, `${recPath}.wav`),
      join(baseDir, `${recPath}.WAV`),
      join(baseDir, recPath),
    ];
    for (const p of candidates) {
      if (existsSync(p)) { filePath = p; break; }
    }
    if (!filePath) {
      const scan = (dir: string): string | null => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) {
            const r = scan(full);
            if (r) return r;
          } else if (e.name.includes(recPath)) return full;
        }
        return null;
      };
      filePath = scan(baseDir);
    }
    if (!filePath) return res.status(404).json({ message: 'Recording file not found' });

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `inline; filename="call-${req.params.id}.wav"`);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error('GET /calls/:id/recording failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT c.*, u.username as agent_username FROM calls c LEFT JOIN users u ON c.agent_id = u.id WHERE c.id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    logger.error('GET /calls/:id failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { disposition_code } = req.body as { disposition_code?: string };
    const updates: string[] = [];
    const params: (string | undefined)[] = [];
    let i = 1;
    if (disposition_code) {
      updates.push(`disposition_code = $${i++}`);
      params.push(disposition_code);
    }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE calls SET ${updates.join(', ')} WHERE id = $${i}`, params);
    const { rows } = await pool.query('SELECT * FROM calls WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    logger.error('PATCH /calls/:id failed', { error: (err as Error).message });
    res.status(500).json({ message: 'Server error' });
  }
});

function chanSpyHandler(mode: 'spy' | 'whisper' | 'barge') {
  return async (req: Request, res: Response) => {
    try {
      const callId = req.params.id;
      const supervisorExt = req.user!.extension as string | undefined;
      if (!supervisorExt) {
        return res.status(400).json({ message: 'Supervisor extension not set' });
      }
      const agentChannel = getAgentChannelForCall(callId);
      if (!agentChannel) {
        return res.status(409).json({
          message: 'Agent channel not available (call may not be connected yet or already ended)',
        });
      }
      const { rows } = await pool.query(
        "SELECT id FROM calls WHERE id = $1 AND status IN ('ringing', 'connected')",
        [callId]
      );
      if (!rows[0]) {
        return res.status(404).json({ message: 'Call not found or not active' });
      }
      await initiateChanSpy(supervisorExt, agentChannel, mode);
      res.json({ message: `${mode} initiated`, supervisor_extension: supervisorExt });
    } catch (err) {
      logger.error('POST /calls/:id/(spy|whisper|barge) failed', { error: (err as Error).message });
      res.status(503).json({
        message: (err as Error).message?.includes('AMI') ? 'AMI not available' : 'Server error',
      });
    }
  };
}

router.post('/:id/transcribe', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const callId = req.params.id;
    const { rows } = await pool.query('SELECT id, recording_path, asterisk_uniqueid FROM calls WHERE id = $1', [callId]);
    if (!rows[0]) return res.status(404).json({ message: 'Call not found' });
    const { addTranscriptionJob } = await import('../jobs/transcription.js');
    await addTranscriptionJob(callId, { delay: 0 });
    res.json({ message: 'Transcription job queued' });
  } catch (err) {
    logger.error('POST /calls/:id/transcribe failed', { error: (err as Error).message });
    res.status(503).json({ message: (err as Error).message || 'Server error' });
  }
});

router.post('/:id/spy', requireRole('admin', 'supervisor'), chanSpyHandler('spy'));
router.post('/:id/whisper', requireRole('admin', 'supervisor'), chanSpyHandler('whisper'));
router.post('/:id/barge', requireRole('admin', 'supervisor'), chanSpyHandler('barge'));

async function transferHandler(req: Request, res: Response): Promise<void> {
  try {
    const validated = req.validated as { destination?: string; transfer_type?: string } | undefined;
    const body = req.body as { destination?: string; transfer_type?: string };
    const destination = validated?.destination ?? body?.destination;
    if (!destination?.trim()) {
      res.status(400).json({ message: 'destination gerekli' });
      return;
    }

    let callId: string | undefined = req.params?.id;
    let call: { id: string } | undefined;

    if (callId) {
      const { rows } = await pool.query<{ id: string }>(
        "SELECT c.id FROM calls c WHERE c.id = $1 AND c.status IN ('ringing', 'connected')",
        [callId]
      );
      call = rows[0];
      if (!call) { res.status(404).json({ message: 'Aktif çağrı bulunamadı' }); return; }
    } else {
      const ext = req.user!.extension as string | undefined;
      if (!ext) { res.status(400).json({ message: 'Dahili numaranız ayarlı değil' }); return; }
      const { rows } = await pool.query<{ id: string }>(
        `SELECT c.id FROM calls c
         JOIN users u ON c.agent_id = u.id
         WHERE u.extension = $1 AND c.status = 'connected'
         ORDER BY c.started_at DESC LIMIT 1`,
        [ext]
      );
      call = rows[0];
      if (!call) { res.status(404).json({ message: 'Aktif görüşmeniz yok' }); return; }
      if (req.user!.role !== 'admin' && req.user!.role !== 'supervisor') {
        const selfCheck = await pool.query<{ agent_id: string }>('SELECT agent_id FROM calls WHERE id = $1', [call.id]);
        if (selfCheck.rows[0]?.agent_id !== req.user!.id) {
          res.status(403).json({ message: 'Sadece kendi aramalarınızı transfer edebilirsiniz' });
          return;
        }
      }
      callId = call.id;
    }

    if (callId && req.params?.id && !['admin', 'supervisor'].includes(req.user!.role)) {
      const owner = (await pool.query<{ agent_id: string }>('SELECT agent_id FROM calls WHERE id = $1', [callId])).rows[0];
      if (owner?.agent_id !== req.user!.id) {
        res.status(403).json({ message: 'Bu aramayı transfer etme yetkiniz yok' });
        return;
      }
    }

    const channels = getChannelsForCall(callId!);
    const customerChannel = channels?.customerChannel;
    if (!customerChannel) {
      res.status(409).json({
        message: 'Kanal bilgisi yok (görüşme henüz bağlı değil veya sona erdi)',
      });
      return;
    }

    const transferType = validated?.transfer_type ?? body?.transfer_type ?? 'blind';
    const doTransfer = transferType === 'attended' ? attendedTransfer : blindTransfer;
    await doTransfer(customerChannel, destination.trim());
    res.json({ message: 'Transfer başlatıldı', destination: destination.trim() });
  } catch (err) {
    logger.error('POST /calls/transfer failed', { error: (err as Error).message });
    res.status(503).json({
      message: (err as Error).message?.includes('AMI') ? 'AMI kullanılamıyor' : (err as Error).message || 'Server error',
    });
  }
}

router.post('/transfer', authMiddleware, validate(transferCallSchema), transferHandler);
router.post('/:id/transfer', authMiddleware, validate(transferCallSchema), transferHandler);

export default router;
