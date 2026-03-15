import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import reviewService from '../services/review.service';
import { sendSuccess, sendError } from '../utils/response';

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    const { itemType, itemId, rating, comment, photos } = req.body;
    
    if (!itemType || !itemId || !rating) {
      return sendError(res, 'INVALID_INPUT', 'itemType, itemId, and rating are required', 400);
    }
    
    if (itemType !== 'pin' && itemType !== 'event') {
      return sendError(res, 'INVALID_INPUT', 'itemType must be "pin" or "event"', 400);
    }
    
    if (rating < 1 || rating > 5) {
      return sendError(res, 'INVALID_INPUT', 'rating must be between 1 and 5', 400);
    }
    
    const review = await reviewService.createReview({
      userId: req.user.id,
      itemType,
      itemId,
      rating,
      comment,
      photos,
    });
    
    return sendSuccess(res, { review }, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_FAILED', error.message || 'Failed to create review', 500);
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    const reviewId = req.params.id;
    const { rating, comment, photos } = req.body;
    
    if (rating && (rating < 1 || rating > 5)) {
      return sendError(res, 'INVALID_INPUT', 'rating must be between 1 and 5', 400);
    }
    
    const review = await reviewService.updateReview(reviewId, req.user.id, {
      rating,
      comment,
      photos,
    } as any);
    
    return sendSuccess(res, { review });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Cannot update another user\'s review', 403);
    }
    return sendError(res, 'UPDATE_FAILED', error.message || 'Failed to update review', 500);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    const reviewId = req.params.id;
    await reviewService.deleteReview(reviewId, req.user.id);
    
    return sendSuccess(res, { message: 'Review deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Cannot delete another user\'s review', 403);
    }
    return sendError(res, 'DELETE_FAILED', error.message || 'Failed to delete review', 500);
  }
};

export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { itemType, itemId } = req.params;
    
    if (itemType !== 'pin' && itemType !== 'event') {
      return sendError(res, 'INVALID_INPUT', 'itemType must be "pin" or "event"', 400);
    }
    
    const reviews = await reviewService.getReviews(itemType as 'pin' | 'event', itemId);
    const rating = await reviewService.getAverageRating(itemType as 'pin' | 'event', itemId);
    
    return sendSuccess(res, { reviews, rating });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get reviews', 500);
  }
};

export const markHelpful = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    const reviewId = req.params.id;
    const result = await reviewService.markHelpful(reviewId, req.user.id);
    
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'MARK_FAILED', 'Failed to mark review as helpful', 500);
  }
};

export const getUserReviews = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const reviews = await reviewService.getUserReviews(userId);
    
    return sendSuccess(res, { reviews });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get user reviews', 500);
  }
};
