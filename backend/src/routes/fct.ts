import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import pool from '../config/db.js';
import { getGoipAllLineStatus, getGoipDeviceInfo, restartGoipLine } from '../services/goip.js';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/v1/fct/ports ────────────────────────────────
// Tüm portları DB + GoIP canlı durumuyla birlikte döner
router.get('/ports', async (_req: Request, res: Response) => {
  try {
    // DB'den port atamaları
    const dbResult = await pool.query(`
      SELECT fp.*,
             u.username AS assigned_username
      FROM fct_ports fp
      LEFT JOIN users u ON fp.assigned_user_id = u.id
      ORDER BY fp.port_number
    `);

    // GoIP16'dan canlı durum
    let liveStatus: any[] = [];
    let goipOnline = false;
    try {
      liveStatus = await getGoipAllLineStatus();
      goipOnline = true;
    } catch {
      goipOnline = false;
    }

    // DB + canlı durumu birleştir
    const ports = dbResult.rows.map((port: any) => {
      const live = liveStatus.find((l) => l.line === port.port_number);
      return {
        ...port,
        live: live
          ? {
              gsm_sim: live.gsm_sim,
              gsm_status: live.gsm_status,
              gsm_signal: parseInt(live.gsm_signal) || 0,
              operator: live.gsm_cur_oper,
              line_state: live.line_state,
              call_count: parseInt(live.call_count) || 0,
              last_call_date: live.last_call_date,
              voip_status: live.voip_status,
            }
          : null,
      };
    });

    res.json({ goipOnline, ports });
  } catch (err) {
    res.status(500).json({ message: 'Port listesi alınamadı', error: (err as Error).message });
  }
});

// ─── GET /api/v1/fct/device ───────────────────────────────
// GoIP16 cihaz bilgileri
router.get('/device', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const info = await getGoipDeviceInfo();
    res.json(info);
  } catch (err) {
    res.status(503).json({ message: 'GoIP16 erişilemez', error: (err as Error).message });
  }
});

// ─── PUT /api/v1/fct/ports/:portNumber ────────────────────
// Port atamasını güncelle
router.put('/ports/:portNumber', requireRole('admin'), async (req: Request, res: Response) => {
  const portNumber = parseInt(req.params.portNumber, 10);
  if (isNaN(portNumber) || portNumber < 1 || portNumber > 16) {
    return res.status(400).json({ message: 'Geçersiz port numarası (1-16)' });
  }

  const { label, sim_number, operator, assigned_extension, assigned_user_id, priority, enabled, notes } = req.body;

  try {
    // Aynı extension başka porta atanmış mı kontrol et
    if (assigned_extension) {
      const existing = await pool.query(
        'SELECT port_number FROM fct_ports WHERE assigned_extension = $1 AND port_number != $2',
        [assigned_extension, portNumber]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          message: `Dahili ${assigned_extension} zaten Port ${existing.rows[0].port_number}'e atanmış`,
        });
      }
    }

    const result = await pool.query(
      `UPDATE fct_ports SET
        label = COALESCE($1, label),
        sim_number = COALESCE($2, sim_number),
        operator = COALESCE($3, operator),
        assigned_extension = $4,
        assigned_user_id = $5,
        priority = COALESCE($6, priority),
        enabled = COALESCE($7, enabled),
        notes = COALESCE($8, notes),
        updated_at = NOW()
      WHERE port_number = $9
      RETURNING *`,
      [label, sim_number, operator, assigned_extension || null, assigned_user_id || null, priority, enabled, notes, portNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Port bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Port güncellenemedi', error: (err as Error).message });
  }
});

// ─── POST /api/v1/fct/ports/:portNumber/restart ──────────
// GSM modülünü restart et
router.post('/ports/:portNumber/restart', requireRole('admin'), async (req: Request, res: Response) => {
  const portNumber = parseInt(req.params.portNumber, 10);
  if (isNaN(portNumber) || portNumber < 1 || portNumber > 16) {
    return res.status(400).json({ message: 'Geçersiz port numarası' });
  }

  try {
    const ok = await restartGoipLine(portNumber);
    res.json({ success: ok, message: ok ? 'GSM modülü yeniden başlatıldı' : 'Restart başarısız' });
  } catch (err) {
    res.status(500).json({ message: 'Restart hatası', error: (err as Error).message });
  }
});

// ─── GET /api/v1/fct/ports/available ──────────────────────
// Arama yapılabilir (aktif + SIM'li + idle) portları döner
router.get('/ports/available', async (_req: Request, res: Response) => {
  try {
    const dbResult = await pool.query(
      'SELECT * FROM fct_ports WHERE enabled = true ORDER BY priority DESC, port_number'
    );

    let liveStatus: any[] = [];
    try {
      liveStatus = await getGoipAllLineStatus();
    } catch {
      // GoIP offline ise DB'deki listeyi dön
    }

    const available = dbResult.rows
      .map((port: any) => {
        const live = liveStatus.find((l) => l.line === port.port_number);
        return { ...port, live };
      })
      .filter((p: any) => {
        if (!p.live) return false;
        return p.live.gsm_sim === 'Y' && p.live.gsm_status === 'Y' && p.live.line_state === 'IDLE';
      });

    res.json(available);
  } catch (err) {
    res.status(500).json({ message: 'Uygun port listesi alınamadı', error: (err as Error).message });
  }
});

export default router;
