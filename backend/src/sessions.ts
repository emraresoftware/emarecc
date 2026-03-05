import type { Server } from 'socket.io';

export interface SessionInfo {
  userId: string;
  username: string;
  role: string;
  extension: string | null;
  connectedAt: string;
}

const bySocketId = new Map<string, SessionInfo>();
let io: Server | null = null;

export function setSessionsIo(server: Server | null): void {
  io = server;
}

export function addSession(socketId: string, data: SessionInfo): void {
  bySocketId.set(socketId, data);
  broadcastSessions();
}

export function updateSessionExtension(socketId: string, extension: string): void {
  const s = bySocketId.get(socketId);
  if (s) {
    s.extension = extension;
    broadcastSessions();
  }
}

export function removeSession(socketId: string): void {
  bySocketId.delete(socketId);
  broadcastSessions();
}

export function getSessions(): SessionInfo[] {
  const seen = new Set<string>();
  const list: SessionInfo[] = [];
  for (const s of bySocketId.values()) {
    if (seen.has(s.userId)) continue;
    seen.add(s.userId);
    list.push({ ...s });
  }
  return list.sort((a, b) => a.username.localeCompare(b.username));
}

function broadcastSessions(): void {
  if (io) io.emit('SESSION_UPDATE', { sessions: getSessions() });
}
