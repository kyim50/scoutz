import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { badRequest } from '../utils/errors';

export const signup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, username } = req.body;
    const result = await authService.signup({ email, password, name, username });

    if ('requiresEmailConfirmation' in result) {
      return sendSuccess(
        res,
        {
          requiresEmailConfirmation: true,
          message: 'Check your email to confirm your account, then log in.',
        },
        201
      );
    }

    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
};

export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { identifier, password } = req.body;
    const result = await authService.login({ identifier, password });
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

export const refreshToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      throw badRequest('Refresh token is required');
    }
    const result = await authService.refreshToken(token);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
    }
    const user = await authService.getCurrentUser(req.user.id);
    return sendSuccess(res, user);
  } catch (error) {
    return next(error);
  }
};

export const checkUsername = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const username = String(req.query.username ?? '');
    if (!username) {
      throw badRequest('username query parameter is required');
    }
    const available = await authService.isUsernameAvailable(username);
    return sendSuccess(res, { username, available });
  } catch (error) {
    return next(error);
  }
};

export const requestPasswordReset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    // Deliberately unconditional — the response must not reveal whether the
    // address is registered.
    return sendSuccess(res, {
      message: 'If an account exists for that email, a reset link is on its way.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Supabase owns the session, so the client signs out locally via
 * `supabase.auth.signOut()`. This endpoint exists so the client has a single
 * place to hang server-side cleanup later (audit log, device de-registration).
 */
export const logout = async (_req: AuthRequest, res: Response) => {
  return sendSuccess(res, { message: 'Successfully logged out' });
};
