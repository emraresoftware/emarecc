import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id: string; username: string; role: string };
      validated?: unknown;
    }
  }
}

export {};
