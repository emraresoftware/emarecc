import pool from '../config/db.js';

interface AmiConfig {
  host: string | null;
  port: number;
  user: string | null;
  secret: string | null;
}

interface DialConfig {
  trunk: string;
  tech: string;
}

interface WebhookConfig {
  url: string | null;
  secret: string | null;
}

const CACHE: {
  webhook_url: string | null | undefined;
  webhook_secret: string | null | undefined;
  ami: AmiConfig | undefined;
  dial: DialConfig | undefined;
} = { webhook_url: null, webhook_secret: null, ami: undefined, dial: undefined };
let cacheTime = 0;
const CACHE_TTL_MS = 10_000;

export async function getAmiConfig(): Promise<AmiConfig> {
  if (Date.now() - cacheTime < CACHE_TTL_MS && CACHE.ami !== undefined) {
    return CACHE.ami;
  }
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('ami_host', 'ami_port', 'ami_user', 'ami_secret')"
    );
    const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    // Docker/ortamda AMI_* set edildiyse onlar kullanılır; yoksa panel (DB) değerleri
    const host = process.env.AMI_HOST || map.ami_host || null;
    const port = parseInt(process.env.AMI_PORT || map.ami_port || '5038', 10);
    const user = process.env.AMI_USER || map.ami_user || null;
    const secret = process.env.AMI_SECRET || map.ami_secret || null;
    const cfg: AmiConfig = { host, port, user, secret };
    CACHE.ami = cfg;
    cacheTime = Date.now();
    return cfg;
  } catch {
    return {
      host: process.env.AMI_HOST || null,
      port: parseInt(process.env.AMI_PORT || '5038', 10),
      user: process.env.AMI_USER || null,
      secret: process.env.AMI_SECRET || null,
    };
  }
}

export function invalidateAmiCache(): void {
  CACHE.ami = undefined;
  CACHE.dial = undefined;
}

export async function getDialConfig(): Promise<DialConfig> {
  if (Date.now() - cacheTime < CACHE_TTL_MS && CACHE.dial !== undefined) {
    return CACHE.dial;
  }
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('ami_dial_trunk', 'ami_dial_tech')"
    );
    const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    const trunk = map.ami_dial_trunk || process.env.AMI_DIAL_TRUNK || '';
    const tech = map.ami_dial_tech || process.env.AMI_DIAL_TECH || 'PJSIP';
    const dial: DialConfig = { trunk: String(trunk).trim(), tech: String(tech).trim() || 'PJSIP' };
    CACHE.dial = dial;
    cacheTime = Date.now();
    return dial;
  } catch {
    CACHE.dial = {
      trunk: process.env.AMI_DIAL_TRUNK || '',
      tech: process.env.AMI_DIAL_TECH || 'PJSIP',
    };
    return CACHE.dial;
  }
}

export async function getCrmWebhookConfig(): Promise<WebhookConfig> {
  if (Date.now() - cacheTime < CACHE_TTL_MS && CACHE.webhook_url !== undefined) {
    return { url: CACHE.webhook_url, secret: CACHE.webhook_secret ?? null };
  }
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('crm_webhook_url', 'crm_webhook_secret')"
    );
    const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    const url = map.crm_webhook_url || process.env.CRM_WEBHOOK_URL || null;
    const secret = map.crm_webhook_secret ?? process.env.CRM_WEBHOOK_SECRET ?? null;
    CACHE.webhook_url = url;
    CACHE.webhook_secret = secret;
    cacheTime = Date.now();
    return { url, secret };
  } catch {
    return {
      url: process.env.CRM_WEBHOOK_URL || null,
      secret: process.env.CRM_WEBHOOK_SECRET ?? null,
    };
  }
}

export function invalidateCache(): void {
  CACHE.webhook_url = undefined;
  CACHE.ami = undefined;
}
