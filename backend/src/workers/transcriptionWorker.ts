import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { existsSync, createReadStream, readdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import pool from '../config/db.js';
import { logger } from '../utils/logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new (IORedis as any)(redisUrl, { maxRetriesPerRequest: null });

async function findRecordingPath(recPath: string): Promise<string | null> {
  const baseDir = process.env.RECORDINGS_PATH || '/recordings';
  if (!existsSync(baseDir)) return null;
  const candidates = [
    join(baseDir, `${recPath}.wav`),
    join(baseDir, `${recPath}.WAV`),
    join(baseDir, `${recPath}.mp3`),
    join(baseDir, `${recPath}.MP3`),
    join(baseDir, recPath),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const scan = (dir: string): string | null => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        const r = scan(full);
        if (r) return r;
      } else if (e.name.includes(recPath)) return full;
    }
    return null;
  };
  return scan(baseDir);
}

async function transcribeWithWhisper(filePath: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = createReadStream(filePath);
  const response = await openai.audio.transcriptions.create({
    file: stream,
    model: 'whisper-1',
    language: 'tr',
    response_format: 'text',
  });
  return (typeof response === 'string' ? response : (response as { text?: string })?.text) ?? '';
}

const worker = new Worker(
  'transcription',
  async (job) => {
    const { callId } = job.data as { callId?: string };
    if (!callId) throw new Error('callId required');

    const { rows } = await pool.query<{
      id: string;
      recording_path: string | null;
      asterisk_uniqueid: string | null;
      transcript: string | null;
    }>(
      'SELECT id, recording_path, asterisk_uniqueid, transcript FROM calls WHERE id = $1',
      [callId]
    );
    const call = rows[0];
    if (!call) throw new Error('Call not found');
    if (call.transcript) return { skipped: true, reason: 'already transcribed' };

    const recPath = call.recording_path ?? call.asterisk_uniqueid;
    if (!recPath) throw new Error('No recording path');

    const filePath = await findRecordingPath(recPath);
    if (!filePath) throw new Error('Recording file not found');

    logger.info('Transcribing call', { callId, filePath });
    const transcript = await transcribeWithWhisper(filePath);
    if (!transcript?.trim()) return { transcript: '' };

    await pool.query(
      'UPDATE calls SET transcript = $1, sentiment_score = $2, ai_summary = $3 WHERE id = $4',
      [transcript.trim(), null, null, callId]
    );
    logger.info('Transcription complete', { callId, length: transcript.length });
    return { transcript: transcript.substring(0, 100) + '...' };
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on('completed', (job) => logger.info('Job completed', { jobId: job.id, data: job.returnvalue }));
worker.on('failed', (job, err) => logger.error('Job failed', { jobId: job?.id, error: err.message }));
worker.on('error', (err) => logger.error('Worker error', { message: err.message }));

logger.info('Transcription worker started');
process.on('SIGTERM', () => worker.close());
process.on('SIGINT', () => worker.close());
