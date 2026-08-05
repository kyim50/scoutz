import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import authService from '../services/auth.service';
import { supabaseAdmin } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface VerifiedIdentity {
  /** Our `users.id`. */
  id: string;
  email: string;
}

/**
 * Verify a Supabase access token and resolve it to an app user, creating the
 * `users` row on first sign-in.
 *
 * Exported so the Socket.IO handshake authenticates through exactly the same
 * path as HTTP — previously the socket layer only understood the old custom
 * JWTs and silently rejected everyone else.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedIdentity | null> {
  if (!token) return null;

  try {
    // getUser() validates the token signature and expiry against Supabase.
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;

    const authUser = data.user;
    const email = (authUser.email ?? '').trim().toLowerCase();
    if (!authUser.id || !email) return null;

    const appUser = await authService.findOrCreateUserFromSupabaseAuth(authUser.id, email);
    return { id: appUser.id, email: appUser.email };
  } catch (err) {
    logger.error('Token verification failed:', err);
    return null;
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.substring(7).trim() || null;
}

/**
 * Sets req.user when a valid token is present, but never rejects. Used on
 * public endpoints that return extra group-scoped content to signed-in users.
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = bearerToken(req);
    if (token) {
      const user = await verifyAccessToken(token);
      if (user) req.user = user;
    }
  } catch {
    // Optional auth never blocks the request.
  }
  next();
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = bearerToken(req);
    if (!token) {
      return sendError(res, 'UNAUTHORIZED', 'Missing or invalid authorization header', 401);
    }

    const user = await verifyAccessToken(token);
    if (!user) {
      return sendError(res, 'INVALID_TOKEN', 'Invalid or expired token', 401);
    }

    req.user = user;
    return next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Authentication failed', 500);
  }
};
