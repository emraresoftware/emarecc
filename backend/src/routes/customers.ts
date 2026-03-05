import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate, customerSchema } from '../middleware/validate.js';
import * as xlsx from 'xlsx';

const router = Router();
router.use(authMiddleware);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, phone, owner_id } = req.query;
    const user = req.user as { id: string; role: string } | undefined;
    let q = `SELECT c.id, c.phone_number, c.first_name, c.last_name, c.notes, c.debt_amount, c.last_payment_date, c.file_number,
      c.takip_id, c.dosya_transfer_tarihi, c.buro_adi, c.dosya_asamasi, c.icrada_acilis_tarihi, c.kapanis_tipi, c.kapanis_tarihi,
      c.bildirim_tarihi, c.icra_dairesi, c.icra_no, c.tckn, c.fatura_id, c.musteri_no, c.owner_id, c.created_at,
      u.username AS owner_username, u.extension AS owner_extension
      FROM customers c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE 1=1`;
    const params: (string | undefined)[] = [];
    let i = 1;
    if (user?.role === 'agent') {
      q += ` AND c.owner_id = $${i++}`;
      params.push(user.id);
    }
    if ((user?.role === 'admin' || user?.role === 'supervisor') && owner_id !== undefined && owner_id !== '') {
      if (String(owner_id) === '__none__') {
        q += ` AND c.owner_id IS NULL`;
      } else {
        q += ` AND c.owner_id = $${i++}`;
        params.push(String(owner_id));
      }
    }
    if (search) {
      q += ` AND (c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR c.phone_number ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }
    if (phone) {
      q += ` AND c.phone_number ILIKE $${i}`;
      params.push(`%${phone}%`);
      i++;
    }
    q += ' ORDER BY c.created_at DESC LIMIT 100';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const user = req.user as { id: string; role: string } | undefined;
    let q = `SELECT phone_number, first_name, last_name, notes, debt_amount, last_payment_date, file_number,
      takip_id, dosya_transfer_tarihi, buro_adi, dosya_asamasi, icrada_acilis_tarihi, kapanis_tipi, kapanis_tarihi,
      bildirim_tarihi, icra_dairesi, icra_no, tckn, fatura_id, musteri_no, owner_id FROM customers WHERE 1=1`;
    const params: (string | undefined)[] = [];
    if (user?.role === 'agent') {
      q += ` AND owner_id = $${params.length + 1}`;
      params.push(user.id);
    }
    if (search) {
      q += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR phone_number ILIKE $1)`;
      params.push(`%${search}%`);
    }
    q += ' ORDER BY created_at DESC LIMIT 5000';
    const { rows } = await pool.query(q, params);
    const headers = ['telefon', 'ad', 'soyad', 'not', 'borc', 'son_odeme', 'dosya_no', 'takip_id', 'dosya_transfer_tarihi', 'buro_adi', 'dosya_asamasi', 'icrada_acilis_tarihi', 'kapanis_tipi', 'kapanis_tarihi', 'bildirim_tarihi', 'icra_dairesi', 'icra_no', 'tckn', 'fatura_id', 'musteri_no', 'owner_id'];
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(',')];
    const exportKeys = ['phone_number', 'first_name', 'last_name', 'notes', 'debt_amount', 'last_payment_date', 'file_number', 'takip_id', 'dosya_transfer_tarihi', 'buro_adi', 'dosya_asamasi', 'icrada_acilis_tarihi', 'kapanis_tipi', 'kapanis_tarihi', 'bildirim_tarihi', 'icra_dairesi', 'icra_no', 'tckn', 'fatura_id', 'musteri_no', 'owner_id'];
    for (const r of rows as Record<string, unknown>[]) {
      csv.push(exportKeys.map((k) => r[k]).map(escape).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=musteriler.csv');
    res.send('\uFEFF' + csv.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/import', requireRole('admin', 'supervisor'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = (req as Request & { file?: { buffer: Buffer; originalname?: string; mimetype?: string } }).file;
    if (!file?.buffer) return res.status(400).json({ message: 'Dosya gerekli' });

    const user = req.user as { id: string; role: string } | undefined;
    let ownerId: string | null = null;
    const assignToAgentId = (req.body as { assign_to_agent_id?: string }).assign_to_agent_id?.trim();
    if (assignToAgentId && (user?.role === 'admin' || user?.role === 'supervisor')) {
      const agentCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [assignToAgentId, 'agent']);
      if (agentCheck.rows[0]) ownerId = assignToAgentId;
    } else if (user?.role === 'agent') {
      ownerId = user.id;
    }

    const name = (file.originalname || '').toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    let rows: string[][] = [];

    if (isExcel) {
      // Excel (XLSX/XLS) dosyasını oku
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as (string | number | null | undefined)[][];
      rows = aoa
        .filter((r) => r && r.some((cell) => cell != null && String(cell).trim() !== ''))
        .map((r) => r.map((cell) => (cell == null ? '' : String(cell))));
    } else {
      // Varsayılan: CSV metni
      const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: 'En az 1 satır veri gerekli' });
      const parseRow = (line: string): string[] => {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if ((c === ',' && !inQuotes) || c === '\n') {
            out.push(cur.trim());
            cur = '';
          } else cur += c;
        }
        out.push(cur.trim());
        return out;
      };
      rows = lines.map((line) => parseRow(line));
    }

    if (rows.length < 2) return res.status(400).json({ message: 'En az 1 satır veri gerekli' });

    const headerRow = rows[0].map((h) => h.toLowerCase().replace(/"/g, '').trim());
    const colIdx = (names: string[]): number => {
      for (const n of names) {
        const i = headerRow.findIndex((h) => h === n || h.includes(n));
        if (i >= 0) return i;
      }
      return -1;
    };
    const phoneNames = ['telefon', 'phone', 'phone_number', 'gsm', 'borçlu gsm'];
    const firstNames = ['ad', 'first_name', 'firstname', 'adi'];
    const lastNames = ['soyad', 'last_name', 'lastname', 'soyadi'];
    const fullNameNames = [
      'ad soyad',
      'ad soyadı',
      'adi soyadi',
      'borçlu adı soyadı',
      'borçlu ad soyad',
      'borclu ad soyad',
    ];
    const notesNames = ['not', 'notes', 'aciklama', 'açıklama'];
    const debtNames = ['borc', 'debt', 'debt_amount', 'bakiye', 'toplam borç', 'toplam borc'];
    const payNames = ['son_odeme', 'last_payment', 'last_payment_date'];
    const fileNames = ['dosya_no', 'file_number', 'fileno', 'dosya', 'dosya no'];
    const takipIdNames = ['takip id', 'takip_id'];
    const dosyaTransferNames = ['dosya transfer tarihi', 'dosya_transfer_tarihi'];
    const buroNames = ['büro adı', 'buro adi', 'buro_adi'];
    const dosyaAsamaNames = ['dosya aşaması', 'dosya asamasi', 'dosya_asamasi'];
    const icradaAcilisNames = ['icrada açılış tarihi', 'icrada acilis tarihi', 'icrada_acilis_tarihi'];
    const kapanisTipiNames = ['kapanış tipi', 'kapanis tipi', 'kapanis_tipi'];
    const kapanisTarihiNames = ['kapanış tarihi', 'kapanis tarihi', 'kapanis_tarihi'];
    const bildirimNames = ['bildirim tarihi', 'bildirim_tarihi'];
    const icraDairesiNames = ['icra dairesi', 'icra_dairesi'];
    const icraNoNames = ['icra no', 'icra_no'];
    const tcknNames = ['tckn', 'tc kimlik'];
    const faturaIdNames = ['fatura id', 'fatura_id'];
    const musteriNoNames = ['müşteri no', 'musteri no', 'musteri_no'];

    const phoneIdx = colIdx(phoneNames) >= 0 ? colIdx(phoneNames) : 0;
    const firstIdx = colIdx(firstNames);
    const lastIdx = colIdx(lastNames);
    const fullIdx = colIdx(fullNameNames);
    const notesIdx = colIdx(notesNames);
    const debtIdx = colIdx(debtNames);
    const payIdx = colIdx(payNames);
    const fileIdx = colIdx(fileNames);
    const takipIdIdx = colIdx(takipIdNames);
    const dosyaTransferIdx = colIdx(dosyaTransferNames);
    const buroIdx = colIdx(buroNames);
    const dosyaAsamaIdx = colIdx(dosyaAsamaNames);
    const icradaAcilisIdx = colIdx(icradaAcilisNames);
    const kapanisTipiIdx = colIdx(kapanisTipiNames);
    const kapanisTarihiIdx = colIdx(kapanisTarihiNames);
    const bildirimIdx = colIdx(bildirimNames);
    const icraDairesiIdx = colIdx(icraDairesiNames);
    const icraNoIdx = colIdx(icraNoNames);
    const tcknIdx = colIdx(tcknNames);
    const faturaIdIdx = colIdx(faturaIdNames);
    const musteriNoIdx = colIdx(musteriNoNames);

    const parseDate = (v: string | null): string | null => {
      if (!v || !v.trim()) return null;
      const s = v.trim();
      const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[0];
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    };
    let inserted = 0;
    let skipped = 0;
    const get = (arr: string[], idx: number): string | null =>
      idx >= 0 && arr[idx] !== undefined ? arr[idx]?.trim() || null : null;

    for (let i = 1; i < rows.length; i++) {
      const arr = rows[i];
      const phone = get(arr, phoneIdx) ?? arr[0];
      if (!phone || !String(phone).replace(/\D/g, '')) { skipped++; continue; }
      let first_name = get(arr, firstIdx) ?? get(arr, 1);
      let last_name = get(arr, lastIdx) ?? get(arr, 2);

      // Eğer ayrı ad/soyad kolonları yoksa ama tek kolon tam ad içeriyorsa (ör. \"Borçlu Adı Soyadı\")
      if (!first_name && !last_name && fullIdx >= 0) {
        const full = get(arr, fullIdx);
        if (full) {
          const parts = full.split(/\s+/);
          if (parts.length === 1) {
            first_name = full;
          } else {
            first_name = parts[0];
            last_name = parts.slice(1).join(' ');
          }
        }
      }
      const notes = get(arr, notesIdx);
      const debt = get(arr, debtIdx);
      const last_payment = get(arr, payIdx);
      const file_number = get(arr, fileIdx);
      const takip_id = get(arr, takipIdIdx);
      const dosya_transfer_tarihi = parseDate(get(arr, dosyaTransferIdx));
      const buro_adi = get(arr, buroIdx);
      const dosya_asamasi = get(arr, dosyaAsamaIdx);
      const icrada_acilis_tarihi = parseDate(get(arr, icradaAcilisIdx));
      const kapanis_tipi = get(arr, kapanisTipiIdx);
      const kapanis_tarihi = parseDate(get(arr, kapanisTarihiIdx));
      const bildirim_tarihi = parseDate(get(arr, bildirimIdx));
      const icra_dairesi = get(arr, icraDairesiIdx);
      const icra_no = get(arr, icraNoIdx);
      const tckn = get(arr, tcknIdx);
      const fatura_id = get(arr, faturaIdIdx);
      const musteri_no = get(arr, musteriNoIdx);
      const debtNum = debt ? parseFloat(String(debt).replace(/[^\d.,-]/g, '').replace(',', '.')) : null;
      const id = uuidv4();
      try {
        await pool.query(
          `INSERT INTO customers (id, phone_number, first_name, last_name, notes, debt_amount, last_payment_date, file_number,
           takip_id, dosya_transfer_tarihi, buro_adi, dosya_asamasi, icrada_acilis_tarihi, kapanis_tipi, kapanis_tarihi,
           bildirim_tarihi, icra_dairesi, icra_no, tckn, fatura_id, musteri_no, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [id, String(phone).trim(), first_name ?? null, last_name ?? null, notes ?? null, debtNum, last_payment ?? null, file_number ?? null,
            takip_id ?? null, dosya_transfer_tarihi, buro_adi ?? null, dosya_asamasi ?? null, icrada_acilis_tarihi, kapanis_tipi ?? null, kapanis_tarihi,
            bildirim_tarihi, icra_dairesi ?? null, icra_no ?? null, tckn ?? null, fatura_id ?? null, musteri_no ?? null, ownerId]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
    res.json({ message: 'İçe aktarım tamamlandı', inserted, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; role: string } | undefined;
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    if (user?.role === 'agent' && rows[0].owner_id && rows[0].owner_id !== user.id) {
      return res.status(404).json({ message: 'Not found' });
    }
    const notes = await pool.query(
      'SELECT id, content, created_at FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );
    const norm = String((rows[0] as Record<string, unknown>).phone_number || '').replace(/\D/g, '').slice(-10);
    const calls = await pool.query(
      `SELECT id, duration, status, started_at, direction, recording_path, asterisk_uniqueid FROM calls 
       WHERE customer_id = $1 
          OR (LENGTH($2) >= 10 AND (
            REPLACE(REPLACE(COALESCE(caller_number,''), ' ', ''), '+', '') LIKE $3
            OR REPLACE(REPLACE(COALESCE(destination_number,''), ' ', ''), '+', '') LIKE $3
          ))
       ORDER BY started_at DESC LIMIT 20`,
      [req.params.id, norm, `%${norm}`]
    );
    let interactions: unknown[] = [];
    try {
      const intRes = await pool.query(
        `SELECT i.id, i.type, i.direction, i.content, i.created_at, i.agent_id, u.username as agent_username
         FROM interactions i
         LEFT JOIN users u ON i.agent_id = u.id
         LEFT JOIN chat_sessions cs ON i.chat_session_id = cs.id
         WHERE i.customer_id = $1 OR cs.customer_id = $1
         ORDER BY i.created_at DESC LIMIT 20`,
        [req.params.id]
      );
      interactions = intRes.rows ?? [];
    } catch {
      /* interactions tablosu yoksa boş dön */
    }
    res.json({
      ...(rows[0] as object),
      notes_list: notes.rows ?? [],
      call_history: calls.rows ?? [],
      interactions,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

const CUSTOMER_EXTRA_KEYS = ['takip_id', 'dosya_transfer_tarihi', 'buro_adi', 'dosya_asamasi', 'icrada_acilis_tarihi', 'kapanis_tipi', 'kapanis_tarihi', 'bildirim_tarihi', 'icra_dairesi', 'icra_no', 'tckn', 'fatura_id', 'musteri_no'] as const;

router.post('/', validate(customerSchema), async (req: Request, res: Response) => {
  try {
    const v = req.validated as Record<string, unknown>;
    const user = req.user as { id: string; role: string } | undefined;
    const id = uuidv4();
    const phone_number = v.phone_number as string;
    const first_name = (v.first_name as string) ?? null;
    const last_name = (v.last_name as string) ?? null;
    const notes = (v.notes as string) ?? null;
    const debt_amount = (v.debt_amount as number) ?? null;
    const last_payment_date = (v.last_payment_date as string) ?? null;
    const file_number = (v.file_number as string) ?? null;
    const extras = CUSTOMER_EXTRA_KEYS.map((k) => (v[k] as string) ?? null);
    const owner_id = user?.role === 'agent' ? user.id : null;
    await pool.query(
      `INSERT INTO customers (id, phone_number, first_name, last_name, notes, debt_amount, last_payment_date, file_number,
       takip_id, dosya_transfer_tarihi, buro_adi, dosya_asamasi, icrada_acilis_tarihi, kapanis_tipi, kapanis_tarihi,
       bildirim_tarihi, icra_dairesi, icra_no, tckn, fatura_id, musteri_no, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [id, phone_number, first_name, last_name, notes, debt_amount, last_payment_date, file_number, ...extras, owner_id]
    );
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const allowed = ['phone_number', 'first_name', 'last_name', 'notes', 'debt_amount', 'last_payment_date', 'file_number', ...CUSTOMER_EXTRA_KEYS];
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        params.push(body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(
      `UPDATE customers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
      params
    );
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { content } = req.body as { content?: string };
    if (!content) return res.status(400).json({ message: 'content required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO customer_notes (id, customer_id, content, created_by) VALUES ($1, $2, $3, $4)',
      [id, req.params.id, content, req.user!.id]
    );
    const { rows } = await pool.query('SELECT * FROM customer_notes WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toplu silme (sadece admin)
router.post('/bulk-delete', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const body = req.body as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'ids array required' });
    }
    const { rowCount } = await pool.query(
      'DELETE FROM customers WHERE id = ANY($1::uuid[])',
      [ids]
    );
    res.json({ deleted: rowCount });
  } catch (err: any) {
    if (err?.code === '23503') {
      return res.status(409).json({ message: 'Bağlı kayıtlar olduğu için bazı müşteriler silinemedi.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
