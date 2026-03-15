import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import pushService from './push.service';

export interface CreateReviewData {
  userId: string;
  itemType: 'pin' | 'event';
  itemId: string;
  rating: number;
  comment?: string;
  photos?: string[];
}

export class ReviewService {
  async createReview(data: CreateReviewData) {
    try {
      const { data: review, error } = await supabaseAdmin
        .from('reviews')
        .upsert({
          user_id: data.userId,
          item_type: data.itemType,
          item_id: data.itemId,
          rating: data.rating,
          comment: data.comment,
          photos: data.photos || [],
        }, { onConflict: 'user_id,item_type,item_id' })
        .select()
        .single();

      if (error) {
        logger.error('Error creating review:', error);
        throw new Error('Failed to create review');
      }

      // Notify item owner (fire-and-forget)
      const table = data.itemType === 'pin' ? 'pins' : 'events';
      Promise.resolve(supabaseAdmin
        .from(table)
        .select('user_id, title')
        .eq('id', data.itemId)
        .single()
      ).then(({ data: item }) => {
          if (item?.user_id && item.user_id !== data.userId) {
            const label = data.itemType === 'pin' ? 'pin' : 'event';
            return pushService.notifyUsers(
              [item.user_id],
              'New Review',
              `Someone left a ${data.rating}★ review on your ${label} "${item.title}"`,
              { type: 'review', itemType: data.itemType, itemId: data.itemId }
            );
          }
          return;
        })
        .catch(() => {});

      return review;
    } catch (error) {
      logger.error('Error in createReview:', error);
      throw error;
    }
  }

  async updateReview(reviewId: string, userId: string, updateData: Partial<CreateReviewData>) {
    try {
      // Verify the review belongs to the user
      const { data: existing } = await supabaseAdmin
        .from('reviews')
        .select('user_id')
        .eq('id', reviewId)
        .single();

      if (!existing || existing.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (updateData.rating) updates.rating = updateData.rating;
      if (updateData.comment !== undefined) updates.comment = updateData.comment;
      if (updateData.photos) updates.photos = updateData.photos;

      const { data, error } = await supabaseAdmin
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating review:', error);
        throw new Error('Failed to update review');
      }

      return data;
    } catch (error) {
      logger.error('Error in updateReview:', error);
      throw error;
    }
  }

  async deleteReview(reviewId: string, userId: string) {
    try {
      // Verify the review belongs to the user
      const { data: existing } = await supabaseAdmin
        .from('reviews')
        .select('user_id')
        .eq('id', reviewId)
        .single();

      if (!existing || existing.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabaseAdmin
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        logger.error('Error deleting review:', error);
        throw new Error('Failed to delete review');
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteReview:', error);
      throw error;
    }
  }

  async getReviews(itemType: 'pin' | 'event', itemId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select(`
          *,
          user:users!reviews_user_id_fkey (
            id,
            name,
            avatar_url
          )
        `)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting reviews:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getReviews:', error);
      return [];
    }
  }

  async getUserReviews(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting user reviews:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getUserReviews:', error);
      return [];
    }
  }

  async markHelpful(reviewId: string, userId: string) {
    try {
      // Check if already marked helpful
      const { data: existing } = await supabaseAdmin
        .from('review_helpful')
        .select('*')
        .eq('review_id', reviewId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Already marked, so unmark it
        await supabaseAdmin
          .from('review_helpful')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', userId);

        // Decrement helpful count
        await supabaseAdmin.rpc('decrement_review_helpful', { review_id: reviewId });

        return { helpful: false };
      } else {
        // Mark as helpful
        await supabaseAdmin
          .from('review_helpful')
          .insert({
            review_id: reviewId,
            user_id: userId,
          });

        // Increment helpful count
        await supabaseAdmin.rpc('increment_review_helpful', { review_id: reviewId });

        return { helpful: true };
      }
    } catch (error) {
      logger.error('Error in markHelpful:', error);
      throw error;
    }
  }

  async getAverageRating(itemType: 'pin' | 'event', itemId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .eq('item_type', itemType)
        .eq('item_id', itemId);

      if (error || !data || data.length === 0) {
        return { average: 0, count: 0 };
      }

      const sum = data.reduce((acc, review) => acc + review.rating, 0);
      const average = sum / data.length;

      return {
        average: Math.round(average * 10) / 10, // Round to 1 decimal
        count: data.length,
      };
    } catch (error) {
      logger.error('Error in getAverageRating:', error);
      return { average: 0, count: 0 };
    }
  }

  /** Batch get rating aggregates for pins (for map pin hierarchy) */
  async getRatingAggregatesForPins(pinIds: string[]): Promise<Record<string, { average: number; count: number }>> {
    if (!pinIds.length) return {};
    try {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('item_id, rating')
        .eq('item_type', 'pin')
        .in('item_id', pinIds);

      if (error || !data) return {};

      const byId: Record<string, number[]> = {};
      for (const row of data) {
        if (!byId[row.item_id]) byId[row.item_id] = [];
        byId[row.item_id].push(row.rating);
      }
      const result: Record<string, { average: number; count: number }> = {};
      for (const id of pinIds) {
        const ratings = byId[id] || [];
        const count = ratings.length;
        const average = count ? Math.round((ratings.reduce((a, r) => a + r, 0) / count) * 10) / 10 : 0;
        result[id] = { average, count };
      }
      return result;
    } catch (error) {
      logger.error('Error in getRatingAggregatesForPins:', error);
      return {};
    }
  }
}

export default new ReviewService();
