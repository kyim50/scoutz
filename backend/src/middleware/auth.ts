import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import { supabaseAdmin } from '../config/supabase';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  /** Set when Bearer token is a valid Supabase access token but we don't have a users row yet (first sign-in). */
  supabaseAuth?: {
    id: string;
    email: string;
  };
}

/** Resolve a Bearer token to an app user. Returns the user or null. */
async function resolveUser(token: string): Promise<{ id: string; email: string } | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
      return { id: decoded.userId, email: decoded.email };
    } catch (err) {
      if (!(err instanceof jwt.TokenExpiredError) && !(err instanceof jwt.JsonWebTokenError)) throw err;
    }
  }
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (authRes.ok) {
      const authUser = await authRes.json() as { id: string; email?: string };
      const sub = authUser?.id;
      const email = (authUser?.email ?? '').trim().toLowerCase();
      if (sub && email) {
        const { data: appUser } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('supabase_auth_id', sub)
          .single();
        if (appUser) return { id: appUser.id, email: appUser.email };
      }
    }
  }
  return null;
}

/**
 * Like authenticate but never rejects — sets req.user if a valid token is
 * present, otherwise just calls next(). Used on public endpoints that return
 * extra group-scoped content for logged-in users.
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const user = await resolveUser(authHeader.substring(7));
      if (user) req.user = user;
    }
  } catch {
    // silently ignore — optional auth never blocks the request
  }
  next();
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'UNAUTHORIZED', 'Missing or invalid authorization header', 401);
    }

    const token = authHeader.substring(7);
    const user = await resolveUser(token);
    if (user) {
      req.user = user;
      return next();
    }

    // Token was valid Supabase auth but no app user row yet (first sign-in)
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (authRes.ok) {
        const authUser = await authRes.json() as { id: string; email?: string };
        const sub = authUser?.id;
        const email = (authUser?.email ?? '').trim().toLowerCase();
        if (sub && email) {
          req.supabaseAuth = { id: sub, email };
          return next();
        }
      }
    }

    return sendError(res, 'INVALID_TOKEN', 'Invalid token', 401);
  } catch (error) {
    logger.error('Authentication error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Authentication failed', 500);
  }
};
