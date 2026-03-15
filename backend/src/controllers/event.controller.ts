import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import eventService from '../services/event.service';
import { sendSuccess, sendError } from '../utils/response';
import crypto from 'crypto';

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    const event = await eventService.createEvent({
      userId: req.user.id,
      ...req.body
    });
    
    return sendSuccess(res, { event }, 201);
  } catch (error) {
    return sendError(res, 'CREATE_FAILED', 'Failed to create event', 500);
  }
};

export const getUpcomingEvents = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, hoursAhead } = req.query;
    
    if (!lat || !lng) {
      return sendError(res, 'INVALID_PARAMS', 'Latitude and longitude are required', 400);
    }
    
    const MIN_RADIUS = 10000; // enforce at least 10 km regardless of what the client sends
    const events = await eventService.getUpcomingEvents(
      parseFloat(lat as string),
      parseFloat(lng as string),
      Math.max(radius ? parseInt(radius as string) : MIN_RADIUS, MIN_RADIUS),
      hoursAhead ? parseInt(hoursAhead as string) : 168,
      req.user?.id
    );
    
    return sendSuccess(res, { events });
  } catch (error) {
    return sendError(res, 'FETCH_FAILED', 'Failed to get events', 500);
  }
};

export const getEventById = async (req: AuthRequest, res: Response) => {
  try {
    const event = await eventService.getEventByIdWithCoords(req.params.id);
    if (!event) return sendError(res, 'NOT_FOUND', 'Event not found', 404);
    return sendSuccess(res, { event });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get event', 500);
  }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    const event = await eventService.updateEvent(req.params.id, req.user.id, req.body);
    return sendSuccess(res, { event });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Not authorized to update this event', 403);
    }
    if (error.message === 'Event not found') {
      return sendError(res, 'NOT_FOUND', 'Event not found', 404);
    }
    return sendError(res, 'UPDATE_FAILED', 'Failed to update event', 500);
  }
};

export const cancelEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    await eventService.cancelEvent(req.params.id, req.user.id);
    return sendSuccess(res, { message: 'Event cancelled successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Not authorized to cancel this event', 403);
    }
    if (error.message === 'Event not found') {
      return sendError(res, 'NOT_FOUND', 'Event not found', 404);
    }
    return sendError(res, 'CANCEL_FAILED', 'Failed to cancel event', 500);
  }
};

export const rsvpEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    const { status } = req.body;
    if (!status || !['interested', 'going'].includes(status)) {
      return sendError(res, 'INVALID_STATUS', 'Status must be "interested" or "going"', 400);
    }
    
    const rsvp = await eventService.rsvpEvent(req.params.id, req.user.id, status);
    return sendSuccess(res, { rsvp });
  } catch (error: any) {
    if (error.message === 'Event is at capacity') {
      return sendError(res, 'AT_CAPACITY', 'Event is at full capacity', 400);
    }
    return sendError(res, 'RSVP_FAILED', 'Failed to RSVP to event', 500);
  }
};

export const cancelRsvp = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    await eventService.cancelRsvp(req.params.id, req.user.id);
    return sendSuccess(res, { message: 'RSVP cancelled successfully' });
  } catch (error) {
    return sendError(res, 'CANCEL_RSVP_FAILED', 'Failed to cancel RSVP', 500);
  }
};

export const generateShareToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    
    const token = crypto.randomBytes(32).toString('hex');
    const shareUrl = await eventService.generateShareToken(req.params.id, token);
    
    return sendSuccess(res, { shareToken: token, shareUrl });
  } catch (error: any) {
    if (error.message === 'Event not found') {
      return sendError(res, 'NOT_FOUND', 'Event not found', 404);
    }
    return sendError(res, 'SHARE_FAILED', 'Failed to generate share link', 500);
  }
};
