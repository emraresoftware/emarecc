import { Router, Request, Response } from 'express';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate, asteriskSchema } from '../middleware/validate.js';
import { getCrmWebhookConfig, getAmiConfig, getDialConfig, invalidateCache, invalidateAmiCache } from '../services/settings.js';
import { reconnectAmi } from '../services/ami.js';
import { getIo } from '../socket.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cfg = await getCrmWebhookConfig();
    const amiCfg = await getAmiConfig();
    const dialCfg = await getDialConfig();
    const { rows } = await pool.query<{ value: string }>("SELECT value FROM system_settings WHERE key = 'wallboard_public_token'").catch(() => ({ rows: [] }));
    res.json({
      crm_webhook_url: cfg.url || '',
      crm_webhook_secret: cfg.secret ? '********' : '',
      wallboard_public_token: rows[0]?.value ?? process.env.WALLBOARD_PUBLIC_TOKEN ?? '',
      ami_host: amiCfg.host || '',
      ami_port: String(amiCfg.port ?? 5038),
      ami_user: amiCfg.user || '',
      ami_secret: amiCfg.secret ? '********' : '',
      ami_dial_trunk: dialCfg.trunk || '',
      ami_dial_tech: dialCfg.tech || 'PJSIP',
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/', validate(asteriskSchema), async (req: Request, res: Response) => {
  try {
    const v = (req.validated ?? req.body) as {
      crm_webhook_url?: string;
      crm_webhook_secret?: string;
      wallboard_public_token?: string;
      ami_host?: string;
      ami_port?: string | number;
      ami_user?: string;
      ami_secret?: string;
      ami_dial_trunk?: string;
      ami_dial_tech?: string;
    };
    const { crm_webhook_url, crm_webhook_secret, wallboard_public_token, ami_host, ami_port, ami_user, ami_secret, ami_dial_trunk, ami_dial_tech } = v;
    const urlVal = crm_webhook_url === '' ? null : (crm_webhook_url ?? null);

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('crm_webhook_url', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [urlVal]
    );

    if (crm_webhook_secret !== undefined) {
      const secretVal = crm_webhook_secret === '' ? null : crm_webhook_secret;
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('crm_webhook_secret', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [secretVal]
      );
    }

    if (wallboard_public_token !== undefined) {
      const val = wallboard_public_token === '' ? null : wallboard_public_token;
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('wallboard_public_token', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [val]
      );
    }

    if (ami_host !== undefined) {
      const val = ami_host === '' ? null : ami_host;
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_host', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [val]
      );
    }
    if (ami_port !== undefined && ami_port !== '') {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_port', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(ami_port)]
      );
    }
    if (ami_user !== undefined) {
      const val = ami_user === '' ? null : ami_user;
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_user', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [val]
      );
    }
    if (ami_secret !== undefined && ami_secret !== '' && ami_secret !== '********') {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_secret', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [ami_secret]
      );
    }
    if (ami_dial_trunk !== undefined) {
      const val = ami_dial_trunk === '' ? null : String(ami_dial_trunk).trim();
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_dial_trunk', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [val]
      );
    }
    if (ami_dial_tech !== undefined && ami_dial_tech !== '') {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_dial_tech', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(ami_dial_tech).trim()]
      );
    }

    invalidateCache();
    invalidateAmiCache();

    if (ami_host !== undefined || ami_port !== undefined || ami_user !== undefined || ami_secret !== undefined) {
      try {
        await reconnectAmi(getIo());
      } catch (e) {
        console.warn('AMI reconnect:', (e as Error).message);
      }
    }

    const cfg = await getCrmWebhookConfig();
    const amiCfg = await getAmiConfig();
    const dialCfg = await getDialConfig();
    const { rows } = await pool.query<{ value: string }>("SELECT value FROM system_settings WHERE key = 'wallboard_public_token'").catch(() => ({ rows: [] }));
    res.json({
      crm_webhook_url: cfg.url || '',
      crm_webhook_secret: cfg.secret ? '********' : '',
      wallboard_public_token: rows[0]?.value ?? '',
      ami_host: amiCfg.host || '',
      ami_port: String(amiCfg.port ?? 5038),
      ami_user: amiCfg.user || '',
      ami_secret: amiCfg.secret ? '********' : '',
      ami_dial_trunk: dialCfg.trunk || '',
      ami_dial_tech: dialCfg.tech || 'PJSIP',
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
