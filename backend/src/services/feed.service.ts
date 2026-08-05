import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import { forbidden } from '../utils/errors';

export class FeedService {
  async createPost(eventId: string, userId: string, content?: string, imageUrl?: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('event_posts')
        .insert({
          event_id: eventId,
          user_id: userId,
          content,
          image_url: imageUrl,
        })
        .select(`
          *,
          user:users (
            id,
            name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        logger.error('Error creating post:', error);
        throw new Error('Failed to create post');
      }

      return data;
    } catch (error) {
      logger.error('Error in createPost:', error);
      throw error;
    }
  }

  async getFeedForEvent(eventId: string, limit: number = 20, offset: number = 0) {
    try {
      // Get posts with user info and reaction counts
      const { data, error } = await supabaseAdmin
        .from('event_posts')
        .select(`
          *,
          user:users (
            id,
            name,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error getting feed:', error);
        throw new Error('Failed to get feed');
      }

      // Get reaction counts and user reactions for each post
      const postsWithReactions = await Promise.all(
        (data || []).map(async (post) => {
          const { data: reactions } = await supabaseAdmin
            .from('event_post_reactions')
            .select('reaction_type, user_id')
            .eq('post_id', post.id);

          // Count reactions by type
          const reactionCounts: { [key: string]: number } = {};
          reactions?.forEach(r => {
            reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
          });

          return {
            ...post,
            reactions: reactionCounts,
            userReactions: reactions?.map(r => ({ type: r.reaction_type, userId: r.user_id })) || [],
          };
        })
      );

      return postsWithReactions;
    } catch (error) {
      logger.error('Error in getFeedForEvent:', error);
      throw error;
    }
  }

  async addReaction(postId: string, userId: string, reactionType: string) {
    try {
      // Validate reaction type
      const validTypes = ['like', 'fire', 'heart'];
      if (!validTypes.includes(reactionType)) {
        throw new Error('Invalid reaction type');
      }

      const { data, error } = await supabaseAdmin
        .from('event_post_reactions')
        .upsert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding reaction:', error);
        throw new Error('Failed to add reaction');
      }

      return data;
    } catch (error) {
      logger.error('Error in addReaction:', error);
      throw error;
    }
  }

  async removeReaction(postId: string, userId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('event_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error removing reaction:', error);
        throw new Error('Failed to remove reaction');
      }

      return true;
    } catch (error) {
      logger.error('Error in removeReaction:', error);
      throw error;
    }
  }

  async deletePost(postId: string, userId: string) {
    try {
      // Check if user owns the post
      const { data: post } = await supabaseAdmin
        .from('event_posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (!post || post.user_id !== userId) {
        throw forbidden();
      }

      const { error } = await supabaseAdmin
        .from('event_posts')
        .delete()
        .eq('id', postId);

      if (error) {
        logger.error('Error deleting post:', error);
        throw new Error('Failed to delete post');
      }

      return true;
    } catch (error) {
      logger.error('Error in deletePost:', error);
      throw error;
    }
  }
}

export default new FeedService();
