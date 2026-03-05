import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { initiateOutbound } from './ami.js';
import { setLastCallExtension } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export interface PowerDialerResult {
  ok: boolean;
  callId?: string;
  error?: string;
}

export async function startPowerDialerCall(campaignId: string): Promise<PowerDialerResult> {
  const campaignResult = await pool.query(
    'SELECT c.*, q.id as qid FROM campaigns c LEFT JOIN queues q ON c.queue_id = q.id WHERE c.id = $1 AND c.type = $2 AND c.status = $3',
    [campaignId, 'power', 'active']
  );
  const campaign = campaignResult.rows[0] as { queue_id?: string } | undefined;
  if (!campaign?.queue_id) return { ok: false, error: 'Campaign not found or not active' };

  const readyAgentsResult = await pool.query(
    `SELECT u.id, u.extension FROM users u
     JOIN queue_members qm ON qm.user_id = u.id
     WHERE qm.queue_id = $1 AND u.role = 'agent' AND u.status = 'ready' AND u.extension IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.agent_id = u.id AND c.status IN ('ringing', 'connected', 'initiating'))
     LIMIT 1`,
    [campaign.queue_id]
  );
  const agent = readyAgentsResult.rows[0] as { id: string; extension: string } | undefined;
  if (!agent) return { ok: false, error: 'No ready agent' };

  const leadResult = await pool.query(
    `SELECT cl.*, COALESCE(cl.phone_number, cu.phone_number) as dial_number
     FROM campaign_leads cl LEFT JOIN customers cu ON cl.customer_id = cu.id
     WHERE cl.campaign_id = $1 AND cl.status = 'new' ORDER BY cl.created_at ASC LIMIT 1`,
    [campaignId]
  );
  const lead = leadResult.rows[0] as { id: string; dial_number?: string; phone_number?: string } | undefined;
  if (!lead) return { ok: false, error: 'No pending leads' };

  const dest = String(lead.dial_number ?? lead.phone_number ?? '').replace(/\D/g, '').slice(-10);
  if (!dest) return { ok: false, error: 'Invalid phone' };

  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO calls (id, agent_id, destination_number, direction, status, external_id, external_type)
       VALUES ($1, $2, $3, 'outbound', 'initiating', $4, $5)`,
      [id, agent.id, dest, lead.id, 'campaign_lead']
    );
    const uniqueId = await initiateOutbound(agent.extension, dest, { CAMPAIGN_LEAD_ID: lead.id });
    await setLastCallExtension(dest, agent.extension);
    await pool.query(
      `UPDATE calls SET status = 'ringing', started_at = NOW(), asterisk_uniqueid = $2 WHERE id = $1`,
      [id, uniqueId]
    );
    await pool.query(
      'UPDATE campaign_leads SET status = $1, attempts = attempts + 1 WHERE id = $2',
      ['ringing', lead.id]
    );
    logger.info('Power dialer call started', { campaignId, leadId: lead.id, agent: agent.extension });
    return { ok: true, callId: id };
  } catch (err) {
    await pool.query(`UPDATE calls SET status = 'failed' WHERE id = $1`, [id]);
    logger.error('Power dialer originate failed', { message: (err as Error).message });
    return { ok: false, error: (err as Error).message };
  }
}
