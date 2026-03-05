import IORedis from 'ioredis';

let client: any = null;

export function getRedis(): any {
  if (!client) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    client = new (IORedis as any)(url, { maxRetriesPerRequest: null });
    client.on('error', (err: Error) => console.warn('Redis:', err.message));
  }
  return client;
}

export async function setLastCallExtension(phoneNumber: string, extension: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = `last_call:${String(phoneNumber).replace(/\D/g, '').slice(-10)}`;
    await redis.set(key, String(extension), 'EX', 3600);
  } catch (e) {
    console.warn('setLastCallExtension:', (e as Error).message);
  }
}

export async function getLastCallExtension(phoneNumber: string): Promise<string | null> {
  try {
    const redis = getRedis();
    const key = `last_call:${String(phoneNumber).replace(/\D/g, '').slice(-10)}`;
    return await redis.get(key);
  } catch {
    return null;
  }
}
