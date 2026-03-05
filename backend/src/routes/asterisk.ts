import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { runAmiCommand, getConnection } from '../services/ami.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const conn = getConnection();
    if (!conn) {
      return res.status(503).json({
        connected: false,
        error: 'AMI bağlı değil. Ayarlar > Asterisk AMI bölümünden yapılandırın.',
      });
    }
    const connAny = conn as { connection?: { readyState?: string } };
    const isConnected = typeof conn.isConnected === 'function' ? conn.isConnected() : connAny.connection?.readyState === 'open';
    if (!isConnected) {
      return res.status(503).json({
        connected: false,
        error: 'AMI bağlantısı yok.',
      });
    }

    const channelsOutput = await runAmiCommand('core show channels').catch((e: Error) => `Hata: ${e.message}`);
    const pjsipOutput = await runAmiCommand('pjsip show endpoints').catch((e: Error) => `Hata: ${e.message}`);
    const queuesOutput = await runAmiCommand('queue show').catch((e: Error) => `Hata: ${e.message}`);

    res.json({
      connected: true,
      channels: channelsOutput,
      pjsip: pjsipOutput,
      queues: queuesOutput,
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      error: (err as Error).message || 'Sunucu hatası',
    });
  }
});

export default router;
