import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js'; // tsx resolves to auth.ts
import { validate, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../middleware/validate.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '1h';

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.validated as { username: string; password: string };
    const requestIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const { rows } = await pool.query(
      'SELECT id, username, extension, role, status, password_hash FROM users WHERE username = $1',
      [username]
    );
    const user = rows[0] as { id: string; username: string; extension: string | null; role: string; status: string; password_hash: string } | undefined;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      console.warn('[AUTH] login_failed', { username, ip: requestIp, reason: 'invalid_credentials' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const payload = { id: user.id, username: user.username, role: user.role };
    const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as SignOptions);
    const refresh_token = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' } as SignOptions);

    await pool.query(
      "UPDATE users SET status = 'ready' WHERE id = $1",
      [user.id]
    );

    console.log('[AUTH] login_success', { username: user.username, role: user.role, ip: requestIp });

    res.json({
      access_token,
      refresh_token,
      expires_in: 3600,
      user: {
        id: user.id,
        username: user.username,
        extension: user.extension,
        role: user.role,
        status: 'ready',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };
    if (!refresh_token) return res.status(400).json({ message: 'refresh_token required' });
    const decoded = jwt.verify(refresh_token, JWT_SECRET) as { type?: string; id: string; username: string; role: string };
    if (decoded.type !== 'refresh') return res.status(401).json({ message: 'Invalid token' });

    // Güvenlik İyileştirmesi: Kullanıcının güncel durumunu DB'den kontrol et
    const { rows } = await pool.query(
      'SELECT id, username, role, status FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = rows[0] as { id: string; username: string; role: string; status: string } | undefined;

    // Kullanıcı silinmişse veya pasife alınmışsa token yenileme
    if (!user || user.status === 'banned') return res.status(403).json({ message: 'Account is not active' });

    const access_token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, // Güncel veriyi kullan
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as SignOptions
    );
    res.json({ access_token, expires_in: 3600 });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query("UPDATE users SET status = 'offline' WHERE id = $1", [req.user!.id]);
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { username } = req.validated as { username: string };
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    const user = rows[0] as { id: string } | undefined;
    if (!user) {
      return res.status(404).json({ message: 'Bu kullanıcı adına ait hesap bulunamadı.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    res.json({ token, redirect: `/reset-password?token=${token}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, new_password } = req.validated as { token: string; new_password: string };
    const { rows } = await pool.query(
      'SELECT prt.user_id FROM password_reset_tokens prt WHERE prt.token = $1 AND prt.expires_at > NOW()',
      [token]
    );
    const row = rows[0] as { user_id: string } | undefined;
    if (!row) {
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş token. Lütfen şifre sıfırlama işlemini tekrar başlatın.' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, row.user_id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    res.json({ message: 'Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, extension, role, status FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (!rows[0]) return res.status(401).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
