import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import userService from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response';

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    // Client sends its IANA zone so streak day-boundaries match the user's
    // local calendar rather than UTC.
    const timeZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
    const user = await userService.getUserProfile(userId, timeZone);

    if (!user) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    return sendSuccess(res, { user });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user profile', 500);
  }
};

export const getLeaderboard = async (_req: AuthRequest, res: Response) => {
  try {
    const leaders = await userService.getLeaderboard();
    return sendSuccess(res, { leaders });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get leaderboard', 500);
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    const userId = req.params.id;
    
    // Users can only update their own profile
    if (userId !== req.user.id) {
      return sendError(res, 'FORBIDDEN', 'Cannot update another user\'s profile', 403);
    }
    
    const user = await userService.updateUserProfile(userId, req.body);
    return sendSuccess(res, { user });
  } catch (error: any) {
    const msg = error?.message || 'Failed to update profile';
    const status = msg === 'Username is already taken' ? 409 : 500;
    return sendError(res, 'UPDATE_FAILED', msg, status);
  }
};

export const getUserPins = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const pins = await userService.getUserPins(userId);
    return sendSuccess(res, { pins });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user pins', 500);
  }
};

export const getUserReports = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const reports = await userService.getUserReports(userId);
    return sendSuccess(res, { reports });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user reports', 500);
  }
};

export const getUserEvents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const events = await userService.getUserEvents(userId);
    return sendSuccess(res, { events });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user events', 500);
  }
};

export const getUserRSVPs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const rsvps = await userService.getUserRSVPs(userId);
    return sendSuccess(res, { rsvps });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user RSVPs', 500);
  }
};

export const getUserActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const days = req.query.days ? parseInt(req.query.days as string) : 91;
    const activity = await userService.getUserActivity(userId, days);
    return sendSuccess(res, { activity });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user activity', 500);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    await userService.deleteAccount(req.user.id);
    return sendSuccess(res, { deleted: true });
  } catch (error: any) {
    return sendError(res, 'DELETE_FAILED', error?.message || 'Failed to delete account', 500);
  }
};

export const updateMyLiveLocation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return sendError(res, 'VALIDATION_ERROR', 'Valid lat and lng are required', 400);
    }

    await userService.updateLiveLocation(req.user.id, lat, lng);
    return sendSuccess(res, { ok: true });
  } catch (error) {
    return sendError(res, 'UPDATE_FAILED', 'Failed to update location', 500);
  }
};

export const savePushToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', 'Valid token is required', 400);
    }
    await userService.savePushToken(req.user.id, token);
    return sendSuccess(res, { ok: true });
  } catch (error) {
    return sendError(res, 'UPDATE_FAILED', 'Failed to save push token', 500);
  }
};

export const getNearbyLiveUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 500;
    const activeWithinMinutes = req.query.activeWithinMinutes
      ? parseInt(req.query.activeWithinMinutes as string, 10)
      : 5;

    if (isNaN(lat) || isNaN(lng)) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid lat and lng are required', 400);
    }

    const users = await userService.getNearbyLiveUsers(
      req.user.id,
      lat,
      lng,
      radius,
      activeWithinMinutes
    );

    return sendSuccess(res, { users });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get nearby users', 500);
  }
};
