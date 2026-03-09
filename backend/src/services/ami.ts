import type { Server as SocketServer } from 'socket.io';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { getLastCallExtension } from '../config/redis.js';
import { getCrmWebhookConfig, getAmiConfig, getDialConfig } from './settings.js';

/** Minimal type for asterisk-manager connection (library has no types) */
interface AmiConnection {
  action: (action: Record<string, unknown>, callback: (err: Error | null, res?: Record<string, unknown>) => void) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  once: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners: (event: string) => void;
  connect: () => void;
  disconnect: () => void;
  isConnected?: () => boolean;
}

interface AmiConfigLike {
  host?: string | null;
  port?: number;
  user?: string | null;
  secret?: string | null;
}

interface BridgeChannels {
  agentChannel: string;
  customerChannel: string;
}

let amiConnection: AmiConnection | null = null;
let currentIo: SocketServer | null = null;
export const getConnection = (): AmiConnection | null => amiConnection;
const extensionSockets = new Map<string, Set<string>>();
const activeCallChannels = new Map<string, BridgeChannels>();

/* ─── Otomatik Reconnect ─── */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const RECONNECT_BASE_MS = 2000;   // 2 saniye
const RECONNECT_MAX_MS  = 30000;  // maksimum 30 saniye
let isReconnecting = false;

function scheduleAmiReconnect(): void {
  if (reconnectTimer || isReconnecting) return;
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts), RECONNECT_MAX_MS);
  reconnectAttempts++;
  logger.warn(`AMI reconnect planlandı: ${delay}ms sonra (deneme #${reconnectAttempts})`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    isReconnecting = true;
    try {
      await reconnectAmi();
    } catch (e) {
      logger.error('AMI reconnect başarısız', { message: (e as Error).message });
      scheduleAmiReconnect();
    } finally {
      isReconnecting = false;
    }
  }, delay);
}

function resetReconnectState(): void {
  reconnectAttempts = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

export function getExtensionSockets(): Map<string, Set<string>> {
  return extensionSockets;
}

export function registerExtension(socketId: string, extension: string): void {
  if (!extensionSockets.has(extension)) {
    extensionSockets.set(extension, new Set());
  }
  extensionSockets.get(extension)!.add(socketId);
}

export function unregisterSocket(socketId: string): void {
  for (const [ext, set] of extensionSockets) {
    set.delete(socketId);
    if (set.size === 0) extensionSockets.delete(ext);
  }
}

async function connectAmi(io: SocketServer, config: AmiConfigLike): Promise<void> {
  // Kapalı devre — host yeterli, user/secret yoksa varsayılan kullan
  const host = config?.host || 'asterisk';
  const port = config?.port || 5038;
  const user = config?.user || 'admin';
  const secret = config?.secret || 'admin';

  if (amiConnection) {
    try {
      amiConnection.removeAllListeners('error');
      amiConnection.removeAllListeners('connect');
      amiConnection.removeAllListeners('close');
      amiConnection.disconnect();
    } catch {
      /* ignore */
    }
    amiConnection = null;
  }

  logger.info('AMI bağlanıyor', { host, port, user });
  currentIo = io;
  const mod = await import('asterisk-manager');
  const ami = mod.default as (port: number, host: string, user: string, secret: string, keepAlive: boolean) => AmiConnection;
  amiConnection = ami(port, host, user, secret, true);

  amiConnection.on('connect', () => {
    logger.info('✅ AMI connected', { host, port });
    resetReconnectState();
  });

  // Bağlantı koptuğunda otomatik yeniden bağlan
  amiConnection.on('close' as string, () => {
    logger.warn('⚠️ AMI bağlantısı koptu — otomatik reconnect başlatılıyor');
    amiConnection = null;
    scheduleAmiReconnect();
  });

  amiConnection.on('managerevent', (...args: unknown[]) => {
    const evt = args[0] as Record<string, unknown>;
    const event = evt.event as string;
    if (event === 'NewChannel' || event === 'AgentConnect') {
      handleIncomingCall(evt, io);
    }
    if (event === 'Bridge') {
      handleBridge(evt);
    }
    if (event === 'Hangup' || event === 'ChannelHangupRequest') {
      handleHangup(evt);
    }
  });

  amiConnection.on('error', (...args: unknown[]) => {
    logger.error('AMI error', { message: (args[0] as Error).message });
    // Error sonrası close event gelmezse de reconnect tetikle
    if (!reconnectTimer && !isReconnecting) {
      amiConnection = null;
      scheduleAmiReconnect();
    }
  });

  amiConnection.connect();
}

export async function initAmi(io: SocketServer): Promise<void> {
  const config = await getAmiConfig();
  await connectAmi(io, config);
}

export async function reconnectAmi(io?: SocketServer | null): Promise<void> {
  const config = await getAmiConfig();
  await connectAmi(io ?? currentIo ?? (null as unknown as SocketServer), config);
}

export function runAmiCommand(command: string): Promise<string> {
  const conn = getConnection();
  if (!conn || !conn.isConnected?.()) return Promise.reject(new Error('AMI bağlı değil'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 15000);
    conn.action(
      { Action: 'Command', Command: command },
      (err: unknown, res?: Record<string, unknown>) => {
        clearTimeout(timer);
        if (err) {
          // asterisk-manager passes error event object when response=error
          const evt = err as Record<string, unknown>;
          if (evt?.response === 'error') {
            return reject(new Error((evt.message ?? evt.output ?? 'Command failed') as string));
          }
          return reject(err as Error);
        }
        resolve((res?.content ?? res?.output ?? res?.Output ?? '') as string);
      }
    );
  });
}

async function redirectToExtension(channel: string, extension: string): Promise<void> {
  const conn = getConnection();
  if (!conn?.isConnected?.()) return;
  return new Promise((resolve, reject) => {
    conn.action(
      {
        Action: 'Redirect',
        Channel: channel,
        Context: 'direct-to-agent',
        Exten: String(extension),
        Priority: 1,
      },
      (err: Error | null) => {
        if (err) return reject(err);
        logger.info('Redirect to last-call extension', { channel, extension });
        resolve();
      }
    );
  });
}

async function handleIncomingCall(evt: Record<string, unknown>, io: SocketServer): Promise<void> {
  const callerId = (evt.calleridnum ?? evt.callerid ?? '') as string;
  const rawCaller = String(evt.callerid ?? '').replace(/^.*<([^>]+)>.*$/, '$1') || callerId;
  const callerIdNum = callerId || rawCaller;
  const dest = evt.exten ?? (evt.channel as string)?.split('-')[1] ?? evt.destination;
  const uniqueId = evt.uniqueid as string;
  const channel = (evt.channel ?? evt.Channel) as string;
  if (!callerIdNum) return;

  const context = String(evt.context ?? evt.Context ?? '');
  let extension = dest != null ? String(dest).replace(/\D/g, '') : '';
  // NOT: Callback routing (last_call redirect) şu an devre dışı.
  // Queue zaten aramayı handle ediyor. Redirect, Queue cevapladıktan sonra
  // çalışınca çakışma yaratıyordu (BYE + yeni INVITE → çift modal sorunu).
  // İleride Queue'ya girmeden ÖNCE redirect yapılacak şekilde refactor edilecek.
  /*
  if ((context === 'from-pstn' || context === 'default') && channel) {
    const lastExt = await getLastCallExtension(callerIdNum);
    if (lastExt) {
      try {
        await redirectToExtension(channel, lastExt);
        extension = lastExt;
      } catch (e) {
        logger.warn('Redirect failed, falling back to queue', { message: (e as Error).message });
      }
    }
  }
  */

  let customer: Record<string, unknown> | null = null;
  try {
    const normalized = String(callerIdNum).replace(/\D/g, '').slice(-10);
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, phone_number, notes, debt_amount, last_payment_date, file_number 
       FROM customers 
       WHERE REPLACE(REPLACE(phone_number, ' ', ''), '+', '') LIKE $1 
       LIMIT 1`,
      [`%${normalized}`]
    );
    customer = (rows[0] as Record<string, unknown>) || null;
  } catch (e) {
    logger.error('Customer lookup error', { message: (e as Error).message });
  }

  const socketIds = extensionSockets.get(extension);
  if (!socketIds?.size) return;

  let callId: string | null = null;
  try {
    const agentResult = await pool.query<{ id: string }>('SELECT id FROM users WHERE extension = $1', [extension]);
    const agent = agentResult.rows[0];
    if (agent) {
      callId = uuidv4();
      await pool.query(
        `INSERT INTO calls (id, agent_id, caller_number, direction, status, asterisk_uniqueid, customer_id)
         VALUES ($1, $2, $3, 'inbound', 'ringing', $4, $5)`,
        [callId, agent.id, callerIdNum, uniqueId, (customer as { id?: string })?.id ?? null]
      );
      activeCallChannels.set(callId, { agentChannel: channel, customerChannel: channel });
    }
  } catch (e) {
    logger.error('Call record create error', { message: (e as Error).message });
  }

  const payload = { callerId: callerIdNum, uniqueId, customer, call_id: callId };
  socketIds.forEach((id) => {
    io.to(id).emit('SCREEN_POP', payload);
  });
  logger.info('Screen pop', { extension, customer: (customer as { first_name?: string })?.first_name ?? 'unknown' });
}

async function handleBridge(evt: Record<string, unknown>): Promise<void> {
  const state = String(evt.bridgestate ?? '').toLowerCase();
  if (state && state !== 'link') return;
  const ch1 = evt.bridgechannel1 ?? evt.channel1;
  const ch2 = evt.bridgechannel2 ?? evt.channel2;
  const tech = process.env.AMI_DIAL_TECH || 'PJSIP';
  const agentCh = [ch1, ch2].find((c) => c && String(c).startsWith(`${tech}/`) && /-\d+$/.test(String(c))) as string | undefined;
  const customerCh = [ch1, ch2].find((c) => c && c !== agentCh) as string | undefined;
  if (!agentCh) return;
  const extMatch = agentCh.match(new RegExp(`${tech}/(\\d+)-`));
  const ext = extMatch?.[1];
  if (!ext) return;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT c.id FROM calls c
       JOIN users u ON c.agent_id = u.id
       WHERE u.extension = $1 AND c.status IN ('ringing', 'initiating') 
       ORDER BY c.started_at DESC NULLS LAST, c.id DESC LIMIT 1`,
      [ext]
    );
    const call = rows[0];
    if (call) {
      activeCallChannels.set(call.id, { agentChannel: agentCh, customerChannel: customerCh! });
      await pool.query(`UPDATE calls SET status = 'connected' WHERE id = $1`, [call.id]);
      logger.info('Bridge: call connected', { callId: call.id, agentChannel: agentCh });
    }
  } catch (e) {
    logger.error('Bridge handle error', { message: (e as Error).message });
  }
}

async function handleHangup(evt: Record<string, unknown>): Promise<void> {
  const uniqueId = evt.uniqueid as string;
  const channel = evt.channel as string;
  const cause = (evt.cause ?? evt.hangupcause ?? 'UNKNOWN') as string;
  const duration = parseInt(String(evt.billableseconds ?? evt.duration ?? 0), 10);
  let mappedCallId: string | null = null;
  const tech = process.env.AMI_DIAL_TECH || 'PJSIP';
  const channelExtMatch = String(channel || '').match(new RegExp(`${tech}/(\\d+)-`));
  const channelExtension = channelExtMatch?.[1] ?? null;

  for (const [cid, data] of activeCallChannels.entries()) {
    if (data.agentChannel === channel || data.customerChannel === channel) {
      activeCallChannels.delete(cid);
      mappedCallId = cid;
      break;
    }
  }

  try {
    const { rows } = await pool.query<{
      id: string;
      callback_url: string | null;
      external_id: string | null;
      external_type: string | null;
      customer_id: string | null;
      caller_number: string | null;
      destination_number: string | null;
    }>(
      'SELECT id, callback_url, external_id, external_type, customer_id, caller_number, destination_number FROM calls WHERE asterisk_uniqueid = $1',
      [uniqueId]
    );
    const call = rows[0];
    if (call) {
      activeCallChannels.delete(call.id);
      let customerId: string | null = call.customer_id;
      if (!customerId) {
        const phone = call.caller_number || call.destination_number || '';
        const normalized = String(phone).replace(/\D/g, '').slice(-10);
        if (normalized.length >= 10) {
          const custResult = await pool.query<{ id: string }>(
            `SELECT id FROM customers WHERE REPLACE(REPLACE(phone_number, ' ', ''), '+', '') LIKE $1 LIMIT 1`,
            [`%${normalized}`]
          );
          const cust = custResult.rows[0];
          if (cust) customerId = cust.id;
          else {
            const newId = uuidv4();
            await pool.query('INSERT INTO customers (id, phone_number) VALUES ($1, $2)', [newId, phone]);
            customerId = newId;
          }
        }
      }
      await pool.query(
        'UPDATE calls SET status = $1, duration = $2, hangup_cause = $3, recording_path = $4, customer_id = COALESCE($5, customer_id) WHERE id = $6',
        [cause === '16' ? 'ANSWERED' : 'NO ANSWER', duration, cause, uniqueId, customerId, call.id]
      );
      if (call.external_type === 'campaign_lead' && call.external_id) {
        const leadStatus = cause === '16' ? 'answered' : ['17', '18', '21'].includes(cause) ? 'busy' : 'no_answer';
        await pool.query('UPDATE campaign_leads SET status = $1 WHERE id = $2', [leadStatus, call.external_id]);
      }
      if (process.env.OPENAI_API_KEY && cause === '16' && duration > 0) {
        import('../jobs/transcription.js')
          .then(({ addTranscriptionJob }) => addTranscriptionJob(call.id))
          .catch((e) => logger.warn('Transcription job add failed', { message: (e as Error).message }));
      }
      const { url: webhookUrl, secret: webhookSecret } = await getCrmWebhookConfig();
      if (webhookUrl) {
        const { rows: updated } = await pool.query(
          `SELECT c.*, u.username as agent_username FROM calls c LEFT JOIN users u ON c.agent_id = u.id WHERE c.id = $1`,
          [call.id]
        );
        const baseUrl = process.env.PUBLIC_URL || process.env.CRM_BASE_URL || 'http://localhost:5000';
        const payload = {
          event: 'CALL_COMPLETED',
          timestamp: new Date().toISOString(),
          payload: {
            call_id: call.id,
            asterisk_uniqueid: uniqueId,
            direction: updated[0]?.direction,
            caller_number: updated[0]?.caller_number,
            destination_number: updated[0]?.destination_number,
            agent_id: updated[0]?.agent_id,
            agent_username: updated[0]?.agent_username,
            status: cause === '16' ? 'ANSWERED' : 'NO_ANSWER',
            duration,
            hangup_cause: cause,
            recording_url: `${baseUrl}/api/v1/calls/${call.id}/recording`,
            external_id: call.external_id,
            external_type: call.external_type,
            callback_url: call.callback_url,
          },
        };
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhookSecret) headers['X-Webhook-Signature'] = webhookSecret;
        fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify(payload) })
          .then((r) => {
            if (!r.ok) logger.warn('Webhook failed', { status: r.status });
          })
          .catch((e) => logger.warn('Webhook error', { message: (e as Error).message }));
      }
    } else if (mappedCallId) {
      await pool.query(
        'UPDATE calls SET status = $1, duration = $2, hangup_cause = $3 WHERE id = $4 AND status IN ($5, $6, $7)',
        [cause === '16' ? 'ANSWERED' : 'NO ANSWER', duration, cause, mappedCallId, 'ringing', 'connected', 'initiating']
      );
    } else if (channelExtension) {
      const fallbackResult = await pool.query<{ id: string }>(
        `SELECT c.id FROM calls c
         JOIN users u ON c.agent_id = u.id
         WHERE u.extension = $1
           AND c.status IN ('ringing', 'initiating', 'connected')
         ORDER BY c.started_at DESC NULLS LAST, c.id DESC
         LIMIT 1`,
        [channelExtension]
      );

      const fallbackCallId = fallbackResult.rows[0]?.id;
      if (fallbackCallId) {
        await pool.query(
          'UPDATE calls SET status = $1, duration = $2, hangup_cause = $3 WHERE id = $4 AND status IN ($5, $6, $7)',
          [cause === '16' ? 'ANSWERED' : 'NO ANSWER', duration, cause, fallbackCallId, 'ringing', 'connected', 'initiating']
        );
        logger.info('Hangup fallback matched by agent extension', { callId: fallbackCallId, extension: channelExtension, cause });
      }
    }
  } catch (e) {
    logger.error('Hangup handle error', { message: (e as Error).message });
  }
}

export async function initiateOutbound(
  extension: string,
  destination: string,
  vars: Record<string, string> = {}
): Promise<string> {
  const conn = getConnection();
  if (!conn) return Promise.reject(new Error('AMI not connected'));
  const { tech, trunk } = await getDialConfig();
  const ext = String(extension).replace(/\D/g, '');
  const agentEndpoint = ext;
  // Check agent endpoint availability
  const agentOut = await runAmiCommand(`pjsip show endpoint ${agentEndpoint}`).catch(() => '');
  if (agentOut && agentOut.includes('Unavailable') && !agentOut.includes('Not in use') && !agentOut.includes('In use')) {
    throw new Error(`Sizin dahiliniz (${ext}) santrale kayıtlı değil. Softphone açık ve "Bağlı" olmalı.`);
  }
  const digits = String(destination).replace(/\D/g, '');
  const num = Number(digits);
  const isInternalExt = digits.length === 4 && num >= 1000 && num <= 1100;
  if (isInternalExt) {
    const endpoint = digits;
    const out = await runAmiCommand(`pjsip show endpoint ${endpoint}`).catch(() => '');
    if (out && out.includes('Unavailable') && !out.includes('Not in use') && !out.includes('In use')) {
      throw new Error(`Dahili ${digits} santrale kayıtlı değil (softphone/cihaz bağlı mı?).`);
    }
  } else if (trunk) {
    const outTrunk = await runAmiCommand(`pjsip show endpoint ${trunk}`).catch(() => '');
    if (outTrunk && outTrunk.includes('Unavailable') && !outTrunk.includes('Not in use') && !outTrunk.includes('In use')) {
      logger.warn('Trunk endpoint unavailable, dialplan fallback ile denenecek', { trunk, extension: ext, destination: digits });
    }
  }
  const agentChannel = `${tech}/${ext}`;
  // Originate: agent'ı arar, cevapladığında dialplan'a yönlendirir
  const destExten = isInternalExt ? digits : (trunk ? `9${digits}` : digits);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutMs = Number(process.env.AMI_ORIGINATE_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('AMI Originate timeout: çağrı başlatılamadı, lütfen trunk/cihaz erişimini kontrol edin.'));
    }, timeoutMs);

    const action: Record<string, unknown> = {
      action: 'Originate',
      channel: agentChannel,
      context: 'from-internal',
      exten: destExten,
      priority: '1',
      timeout: 60000,
      callerid: destination,
    };
    if (Object.keys(vars).length) action.variable = vars;
    conn.action(action, (err: Error | null, res?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (err) {
        const ev = (err as unknown) as Record<string, unknown> | undefined;
        let msg = (ev?.message ?? ev?.Message ?? (err as Error).message ?? String(err)) as string;
        if (msg === 'Originate failed' || /originate\s*failed/i.test(msg)) {
          msg = `Arama başlatılamadı. Sizin dahili (${extension}) veya aranan taraf santrale kayıtlı olmalı; softphone "Bağlı" olmalı.`;
        }
        return reject(new Error(msg));
      }
      const uniqueId = (res?.UniqueID ?? res?.uniqueid ?? res?.Response ?? 'unknown') as string;
      resolve(uniqueId);
    });
  });
}

export function initiateChanSpy(
  supervisorExtension: string,
  agentChannel: string,
  mode: 'spy' | 'whisper' | 'barge' = 'spy'
): Promise<string> {
  const conn = getConnection();
  if (!conn) return Promise.reject(new Error('AMI not connected'));
  const tech = process.env.AMI_DIAL_TECH || 'PJSIP';
  const opts = mode === 'whisper' ? 'w' : mode === 'barge' ? 'b' : 'q';
  const data = `${agentChannel},${opts}`;
  return new Promise((resolve, reject) => {
    conn.action(
      {
        action: 'Originate',
        channel: `${tech}/${supervisorExtension}`,
        application: 'ChanSpy',
        data,
        timeout: 30000,
      },
      (err: Error | null, res?: Record<string, unknown>) => {
        if (err) return reject(err);
        const uniqueId = (res?.UniqueID ?? res?.uniqueid ?? res?.Response ?? 'unknown') as string;
        resolve(uniqueId);
      }
    );
  });
}

export function getAgentChannelForCall(callId: string): string | null {
  return activeCallChannels.get(callId)?.agentChannel ?? null;
}

export function getChannelsForCall(callId: string): BridgeChannels | null {
  return activeCallChannels.get(callId) ?? null;
}

export async function hangupCall(callId: string): Promise<void> {
  const conn = getConnection();
  if (!conn) return Promise.reject(new Error('AMI not connected'));
  const channelsToHangup = new Set<string>();
  const mapped = activeCallChannels.get(callId);
  if (mapped?.agentChannel) channelsToHangup.add(mapped.agentChannel);
  if (mapped?.customerChannel) channelsToHangup.add(mapped.customerChannel);

  const { rows } = await pool.query<{ asterisk_uniqueid: string | null; extension: string | null; destination_number: string | null }>(
    `SELECT c.asterisk_uniqueid, u.extension
            , c.destination_number
     FROM calls c
     LEFT JOIN users u ON u.id = c.agent_id
     WHERE c.id = $1 AND c.status IN ($2, $3, $4)`,
    [callId, 'ringing', 'connected', 'initiating']
  );
  const uniqueId = rows[0]?.asterisk_uniqueid || null;
  const extension = String(rows[0]?.extension || '').replace(/\D/g, '');
  const destination = String(rows[0]?.destination_number || '').replace(/\D/g, '');
  const prefixedDestination = destination ? `9${destination}` : '';

  try {
    const out = await runAmiCommand('core show channels concise');
    const lines = out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const parts = line.split('!');
      const channel = (parts[0] ?? '').trim();
      const exten = String(parts[2] ?? '').trim();
      const callerId = String(parts[7] ?? '').trim();
      const bridgedChannel = String(parts[11] ?? '').trim();
      if (!channel) continue;
      if (uniqueId && line.includes(uniqueId)) {
        channelsToHangup.add(channel);
        if (bridgedChannel) channelsToHangup.add(bridgedChannel);
      }
      if (extension && new RegExp(`^(PJSIP|SIP)/${extension}-`, 'i').test(channel)) {
        channelsToHangup.add(channel);
        if (bridgedChannel) channelsToHangup.add(bridgedChannel);
      }

      const isFctTrunkLeg = /^PJSIP\/fct-trunk-/i.test(channel);
      const matchesDialedDestination =
        !!prefixedDestination && (exten === prefixedDestination || callerId === prefixedDestination || line.includes(`sip:${destination}@`));

      if (isFctTrunkLeg && matchesDialedDestination) {
        channelsToHangup.add(channel);
        if (bridgedChannel) channelsToHangup.add(bridgedChannel);
      }
    }
  } catch {
    /* ignore channel lookup errors */
  }

  if (!channelsToHangup.size) {
    return Promise.reject(new Error('Çağrı kanalı bulunamadı (çağrı bağlı değil veya zaten bitmiş olabilir)'));
  }

  let terminated = 0;
  const hangupOne = (channel: string): Promise<void> =>
    new Promise((resolve, reject) => {
      conn.action(
        { action: 'Hangup', channel },
        (err: Error | null, res?: Record<string, unknown>) => {
          if (err) return reject(err);
          if ((res as { Response?: string })?.Response === 'Error') {
            const msg = (res?.Message as string) || 'Hangup failed';
            if (/no such channel|not found/i.test(msg)) return resolve();
            return reject(new Error(msg));
          }
          resolve();
        }
      );
    });

  for (const channel of channelsToHangup) {
    try {
      await hangupOne(channel);
      terminated += 1;
    } catch (e) {
      logger.warn('Hangup action failed for channel', { channel, message: (e as Error).message });
    }
  }

  if (terminated === 0) {
    return Promise.reject(new Error('Çağrı kanalı sonlandırılamadı'));
  }
}

export function blindTransfer(customerChannel: string, destination: string): Promise<void> {
  return doRedirect(customerChannel, destination, 'from-internal');
}

export function attendedTransfer(customerChannel: string, destination: string): Promise<void> {
  return doRedirect(customerChannel, destination, 'transfer-announce');
}

function doRedirect(customerChannel: string, destination: string, context: string): Promise<void> {
  const conn = getConnection();
  if (!conn) return Promise.reject(new Error('AMI not connected'));
  const dest = String(destination).replace(/\D/g, '');
  const exten = dest.length <= 4 ? dest : `9${dest}`;
  return new Promise((resolve, reject) => {
    conn.action(
      {
        Action: 'Redirect',
        Channel: customerChannel,
        Context: context,
        Exten: exten,
        Priority: 1,
      },
      (err: Error | null, res?: Record<string, unknown>) => {
        if (err) return reject(err);
        if (res?.Response === 'Error') return reject(new Error((res.Message as string) || 'Redirect failed'));
        resolve();
      }
    );
  });
}
