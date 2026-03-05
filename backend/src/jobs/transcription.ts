import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new (IORedis as any)(redisUrl);

export const transcriptionQueue = new Queue('transcription', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
  },
});

export interface TranscriptionJobOptions {
  delay?: number;
}

export async function addTranscriptionJob(callId: string, options: TranscriptionJobOptions = {}): Promise<void> {
  const delay = options.delay ?? 5000;
  await transcriptionQueue.add('transcribe', { callId }, { delay });
}
