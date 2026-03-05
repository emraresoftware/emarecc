import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { fillScriptPlaceholders } from './scripts.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, q.name as queue_name, s.name as script_name
      FROM campaigns c
      LEFT JOIN queues q ON c.queue_id = q.id
      LEFT JOIN scripts s ON c.script_id = s.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (status && !['draft', 'active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const updates: string[] = [];
    const params: (string | undefined)[] = [];
    let i = 1;
    if (status) { updates.push(`status = $${i++}`); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${i}`, params);
    const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, type, queue_id, script_id } = req.body as { name?: string; type?: string; queue_id?: string; script_id?: string };
    if (!name) return res.status(400).json({ message: 'name required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO campaigns (id, name, type, queue_id, script_id) VALUES ($1, $2, $3, $4, $5)',
      [id, name, type ?? 'preview', queue_id ?? null, script_id ?? null]
    );
    const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/next-lead', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    const campaignResult = await pool.query(
      'SELECT c.*, s.content as script_content FROM campaigns c LEFT JOIN scripts s ON c.script_id = s.id WHERE c.id = $1',
      [campaignId]
    );
    const campaign = campaignResult.rows[0] as { script_content?: string } | undefined;
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const leadResult = await pool.query(`
      SELECT cl.*, cu.first_name, cu.last_name, COALESCE(cl.phone_number, cu.phone_number) as dial_number,
        cu.debt_amount, cu.file_number, cu.last_payment_date
      FROM campaign_leads cl
      LEFT JOIN customers cu ON cl.customer_id = cu.id
      WHERE cl.campaign_id = $1 AND cl.status = 'new'
      ORDER BY cl.created_at ASC LIMIT 1
    `, [campaignId]);
    const lead = leadResult.rows[0] as Record<string, unknown> | undefined;

    if (!lead) return res.json({ lead: null, script: null });

    const defaultScript = (await pool.query('SELECT content FROM scripts WHERE is_default = true LIMIT 1')).rows[0] as { content?: string } | undefined;
    const scriptContent = campaign.script_content ?? defaultScript?.content;
    const customer = {
      first_name: lead.first_name as string | undefined,
      last_name: lead.last_name as string | undefined,
      debt_amount: lead.debt_amount as number | string | undefined,
      file_number: lead.file_number as string | undefined,
      last_payment_date: lead.last_payment_date as string | undefined,
    };
    const script = scriptContent ? fillScriptPlaceholders(scriptContent, customer) : null;

    res.json({
      lead: { id: lead.id, customer_id: lead.customer_id, phone_number: lead.dial_number, ...customer },
      script,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/leads/bulk', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const { customer_ids } = req.body as { customer_ids?: string[] };
    if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({ message: 'customer_ids array required' });
    }
    const campaignId = req.params.id;
    const campaign = (await pool.query<{ id: string }>('SELECT id FROM campaigns WHERE id = $1', [campaignId])).rows[0];
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    const { rows: customers } = await pool.query<{ id: string; phone_number: string }>(
      'SELECT id, phone_number FROM customers WHERE id = ANY($1)',
      [customer_ids]
    );
    let added = 0;
    for (const c of customers) {
      const existing = (await pool.query(
        'SELECT 1 FROM campaign_leads WHERE campaign_id = $1 AND (customer_id = $2 OR phone_number = $3)',
        [campaignId, c.id, c.phone_number]
      )).rows[0];
      if (existing) continue;
      await pool.query(
        'INSERT INTO campaign_leads (id, campaign_id, customer_id, phone_number) VALUES ($1, $2, $3, $4)',
        [uuidv4(), campaignId, c.id, c.phone_number]
      );
      added++;
    }
    res.json({ message: `${added} lead kampanyaya eklendi`, added, total: customers.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/leads/:leadId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status) return res.status(400).json({ message: 'status required' });
    await pool.query(
      'UPDATE campaign_leads SET status = $1 WHERE id = $2 AND campaign_id = $3',
      [status, req.params.leadId, req.params.id]
    );
    const { rows } = await pool.query('SELECT * FROM campaign_leads WHERE id = $1', [req.params.leadId]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/leads', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { customer_id, phone_number } = req.body as { customer_id?: string; phone_number?: string };
    const phone = phone_number ?? (await pool.query<{ phone_number: string }>('SELECT phone_number FROM customers WHERE id = $1', [customer_id!])).rows[0]?.phone_number;
    if (!phone) return res.status(400).json({ message: 'phone_number or customer_id required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO campaign_leads (id, campaign_id, customer_id, phone_number) VALUES ($1, $2, $3, $4)',
      [id, req.params.id, customer_id ?? null, phone]
    );
    const { rows } = await pool.query('SELECT * FROM campaign_leads WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
