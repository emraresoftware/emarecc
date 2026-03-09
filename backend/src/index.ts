import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import { logger } from './utils/logger.js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { setIo, getIo } from './socket.js';
import { addSession, removeSession, updateSessionExtension, setSessionsIo } from './sessions.js';
import { initAmi, reconnectAmi, registerExtension, unregisterSocket } from './services/ami.js';
import { startPowerDialerCall } from './services/dialer.js';
import pool from './config/db.js';
import authRoutes from './routes/auth.js';
import customersRoutes from './routes/customers.js';
import callsRoutes from './routes/calls.js';
import usersRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import testRoutes from './routes/test.js';
import queuesRoutes from './routes/queues.js';
import scriptsRoutes from './routes/scripts.js';
import campaignsRoutes from './routes/campaigns.js';
import settingsRoutes from './routes/settings.js';
import skillsRoutes from './routes/skills.js';
import chatRoutes from './routes/chat.js';
import asteriskRoutes from './routes/asterisk.js';
import debugRoutes from './routes/debug.js';
import sessionsRoutes from './routes/sessions.js';
import fctRoutes from './routes/fct.js';

const PORT = parseInt(process.env.PORT || '5001', 10);
const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: '*' },
});
setIo(io);
setSessionsIo(io);

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LIMIT_MAX || '3000', 10), message: { message: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LIMIT_LOGIN || '50', 10), message: { message: 'Too many login attempts' } });
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' } }));
// Debug/polling endpoint'leri rate limit dışında — sürekli polling yapıyorlar
app.use('/api/v1/debug', (_req, _res, next) => next());
app.use('/api/v1/', apiLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/test', testRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/calls', callsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/queues', queuesRoutes);
app.use('/api/v1/scripts', scriptsRoutes);
app.use('/api/v1/campaigns', campaignsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/skills', skillsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/asterisk', asteriskRoutes);
app.use('/api/v1/debug', debugRoutes);
app.use('/api/v1/sessions', sessionsRoutes);
app.use('/api/v1/fct', fctRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  socket.on('auth', (data: { token?: string }) => {
    if (!data?.token) return;
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'secret') as { id: string; username: string; role: string };
      socket.data.authenticated = true;
      socket.data.userId = decoded.id;
      socket.data.username = decoded.username;
      socket.data.role = decoded.role;
      addSession(socket.id, {
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role,
        extension: null,
        connectedAt: new Date().toISOString(),
      });
    } catch {
      socket.data.authenticated = false;
    }
  });
  socket.on('extension:register', (data: { extension?: string }) => {
    const ext = data?.extension?.toString();
    if (ext) {
      socket.data.extension = ext;
      registerExtension(socket.id, ext);
      updateSessionExtension(socket.id, ext);
    }
  });
  socket.on('disconnect', () => {
    removeSession(socket.id);
    unregisterSocket(socket.id);
  });
});

async function broadcastStats() {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'ready') as ready,
        COUNT(*) FILTER (WHERE status = 'paused') as paused,
        COUNT(*) FILTER (WHERE status = 'offline') as offline
      FROM users WHERE role = 'agent'
    `);
    const r = rows[0] as { ready?: string; paused?: string } | undefined;
    getIo()?.emit('STATS_UPDATE', {
      agents: { ready: parseInt(r?.ready ?? '0', 10) || 0, busy: 0, paused: parseInt(r?.paused ?? '0', 10) || 0 },
      queue_waiting: 0,
      avg_wait_time: 0,
    });
  } catch {
    /* ignore */
  }
}
setInterval(broadcastStats, 3000);

async function runPowerDialerCheck() {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM campaigns WHERE type = 'power' AND status = 'active' AND queue_id IS NOT NULL"
    );
    for (const c of rows as { id: string }[]) {
      try {
        const res = await startPowerDialerCall(c.id);
        if (res.ok) break;
      } catch (e) {
        logger.warn('Power dialer check', { campaignId: c.id, message: (e as Error).message });
      }
    }
  } catch {
    /* ignore */
  }
}
setInterval(runPowerDialerCheck, 20000);

async function cleanupStaleCalls() {
  try {
    await pool.query(
      `UPDATE calls
       SET status = 'failed'
       WHERE status IN ('ringing', 'connected', 'initiating')
         AND started_at < NOW() - INTERVAL '30 minutes'`
    );
  } catch (e) {
    logger.warn('cleanupStaleCalls error', { message: (e as Error).message });
  }
}
setInterval(cleanupStaleCalls, 300000);

initAmi(io).catch((e: Error) => console.warn('AMI init:', e.message));
http.listen(PORT, () => {
  logger.info('OpenCC Backend started', { port: PORT });
  logger.info('Run "npm run seed" for initial users (admin/admin123, agent1/admin123)');
});
