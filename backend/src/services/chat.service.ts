import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import { forbidden } from '../utils/errors';
import pushService from './push.service';
import { filterCooldown } from '../utils/notificationCooldown';

const ANONYMOUS_USER = { id: 'anonymous', name: 'Anonymous', avatar_url: null };

function maskAnonymousUser(row: any): any {
  if (row.is_anonymous) {
    return { ...row, user: ANONYMOUS_USER };
  }
  return row;
}

export class ChatService {
  async saveMessage(eventId: string, userId: string, message: string, isAnonymous = false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('event_messages')
        .insert({
          event_id: eventId,
          user_id: userId,
          message,
          is_anonymous: isAnonymous,
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
        logger.error('Error saving message:', error);
        throw new Error('Failed to save message');
      }

      const saved = maskAnonymousUser(data);

      // Notify event creator (fire-and-forget, with cooldown)
      Promise.resolve(supabaseAdmin
        .from('events')
        .select('user_id, title')
        .eq('id', eventId)
        .single()
      ).then(({ data: event }) => {
          if (event?.user_id && event.user_id !== userId) {
            const eligible = filterCooldown([event.user_id], 'event_chat', eventId);
            if (!eligible.length) return;
            const senderName = isAnonymous ? 'Someone' : (saved.user?.name || 'Someone');
            return pushService.notifyUsers(
              eligible,
              'New message in your event',
              `${senderName}: ${message.slice(0, 80)}`,
              { type: 'event_chat', eventId }
            );
          }
          return;
        })
        .catch(() => {});

      return saved;
    } catch (error) {
      logger.error('Error in saveMessage:', error);
      throw error;
    }
  }

  async getEventMessages(eventId: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('event_messages')
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
        logger.error('Error getting messages:', error);
        throw new Error('Failed to get messages');
      }

      return (data || []).reverse().map(maskAnonymousUser);
    } catch (error) {
      logger.error('Error in getEventMessages:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string) {
    try {
      // Check if user owns the message
      const { data: message } = await supabaseAdmin
        .from('event_messages')
        .select('user_id')
        .eq('id', messageId)
        .single();

      if (!message || message.user_id !== userId) {
        throw forbidden();
      }

      const { error } = await supabaseAdmin
        .from('event_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        logger.error('Error deleting message:', error);
        throw new Error('Failed to delete message');
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteMessage:', error);
      throw error;
    }
  }

  /**
   * Get unread message counts for a batch of events for a given user.
   * Returns { [eventId]: unreadCount }.
   *
   * This mirrors the logic used for report chats in ReportChatService.
   */
  async getUnreadCounts(userId: string, eventIds: string[]): Promise<Record<string, number>> {
    if (!eventIds.length) return {};

    try {
      const { data: reads } = await supabaseAdmin
        .from('event_message_reads')
        .select('event_id, last_read_at')
        .eq('user_id', userId)
        .in('event_id', eventIds);

      const readMap: Record<string, string> = {};
      (reads || []).forEach((r: any) => {
        readMap[r.event_id] = r.last_read_at;
      });

      const counts: Record<string, number> = {};

      await Promise.all(
        eventIds.map(async (eventId) => {
          try {
            const lastRead = readMap[eventId];
            let query = supabaseAdmin
              .from('event_messages')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', eventId)
              .neq('user_id', userId); // don't count own messages

            if (lastRead) {
              query = query.gt('created_at', lastRead);
            }

            const { count } = await query;
            counts[eventId] = count ?? 0;
          } catch {
            counts[eventId] = 0;
          }
        })
      );

      return counts;
    } catch (error) {
      logger.error('Error in getUnreadCounts (event):', error);
      return {};
    }
  }

  /**
   * Mark all messages in an event chat as read for a user.
   */
  async markAsRead(eventId: string, userId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('event_message_reads')
        .upsert(
          { event_id: eventId, user_id: userId, last_read_at: new Date().toISOString() },
          { onConflict: 'event_id,user_id' }
        );

      if (error) {
        logger.error('Error marking event chat as read:', error);
      }
    } catch (error) {
      logger.error('Error in markAsRead (event):', error);
    }
  }
}

export default new ChatService();
