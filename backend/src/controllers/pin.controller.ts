import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pinService from '../services/pin.service';
import reviewService from '../services/review.service';
import { sendSuccess, sendError } from '../utils/response';

export const createPin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    const pin = await pinService.createPin({
      userId: req.user.id,
      ...req.body
    });
    
    return sendSuccess(res, { pin }, 201);
  } catch (error: any) {
    if (error.code === 'DUPLICATE_PIN') {
      return sendError(res, 'DUPLICATE_PIN', error.message, 409, { existingPin: error.existingPin });
    }
    return sendError(res, 'CREATE_FAILED', 'Failed to create pin', 500);
  }
};

export const getForYouPins = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;
    const pins = await pinService.getForYouPins(
      req.user?.id,
      parseFloat(lat as string),
      parseFloat(lng as string),
      radius ? parseInt(radius as string) : 5000,
    );
    return sendSuccess(res, { pins });
  } catch (error) {
    return sendError(res, 'FETCH_FAILED', 'Failed to get recommendations', 500);
  }
};

export const getNearbyPins = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, type } = req.query;
    const MIN_RADIUS = 5000; // enforce at least 5 km regardless of what the client sends
    const pins = await pinService.searchNearby({
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
      radius: Math.max(radius ? parseInt(radius as string) : MIN_RADIUS, MIN_RADIUS),
      type: type as string,
      userId: req.user?.id,
    });
    const pinIds = (pins as any[]).map((p) => p.id).filter(Boolean);
    const aggregates = pinIds.length ? await reviewService.getRatingAggregatesForPins(pinIds) : {};
    const enrichedPins = (pins as any[]).map((pin) => {
      const { average = 0, count = 0 } = aggregates[pin.id] || {};
      return { ...pin, review_count: count, average_rating: average };
    });
    return sendSuccess(res, { pins: enrichedPins });
  } catch (error) {
    return sendError(res, 'SEARCH_FAILED', 'Failed to get pins', 500);
  }
};

export const getPinById = async (req: AuthRequest, res: Response) => {
  try {
    const pin = await pinService.getPinById(req.params.id);
    if (!pin) return sendError(res, 'NOT_FOUND', 'Pin not found', 404);
    return sendSuccess(res, { pin });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get pin', 500);
  }
};

export const updatePin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const pin = await pinService.updatePin(req.params.id, req.user.id, req.body);
    return sendSuccess(res, { pin });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Not authorized to update this pin', 403);
    }
    return sendError(res, 'UPDATE_FAILED', 'Failed to update pin', 500);
  }
};

export const deletePin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    await pinService.deletePin(req.params.id, req.user.id);
    return sendSuccess(res, { message: 'Pin deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Not authorized to delete this pin', 403);
    }
    return sendError(res, 'DELETE_FAILED', 'Failed to delete pin', 500);
  }
};

export const verifyPin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const { isAccurate, comment } = req.body;
    const verification = await pinService.verifyPin(req.params.id, req.user.id, isAccurate, comment);
    return sendSuccess(res, { verification });
  } catch (error) {
    return sendError(res, 'VERIFY_FAILED', 'Failed to verify pin', 500);
  }
};
