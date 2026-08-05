import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import { forbidden } from '../utils/errors';
import reportService from './report.service';
import pushService from './push.service';
import { filterCooldown } from '../utils/notificationCooldown';

const ANONYMOUS_USER = { id: 'anonymous', name: 'Anonymous', avatar_url: null };

function maskAnonymousUser(row: any): any {
  if (row.is_anonymous) {
    return { ...row, user: ANONYMOUS_USER };
  }
  return row;
}

export class ReportChatService {
  async saveMessage(reportId: string, userId: string, message: string, isAnonymous = false) {
    try {
      // Fetch report metadata (type + creator)
      const { data: report } = await supabaseAdmin
        .from('reports')
        .select('type, user_id')
        .eq('id', reportId)
        .single();

      const { data, error } = await supabaseAdmin
        .from('report_messages')
        .insert({
          report_id: reportId,
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
        logger.error('Error saving report message:', error);
        throw new Error('Failed to save message');
      }

      // Extend report expiry non-blocking
      if (report?.type) {
        reportService.extendExpiry(reportId, report.type).catch(() => {});
      }

      const saved = maskAnonymousUser(data);

      // Notify report creator + prior participants (fire-and-forget, with cooldown)
      Promise.resolve(supabaseAdmin
        .from('report_messages')
        .select('user_id')
        .eq('report_id', reportId)
        .neq('user_id', userId)
      ).then(({ data: prior }) => {
          const participantIds = new Set((prior || []).map((m: any) => m.user_id));
          if (report?.user_id && report.user_id !== userId) {
            participantIds.add(report.user_id);
          }
          const candidates = [...participantIds].filter(Boolean) as string[];
          const eligible = filterCooldown(candidates, 'report_chat', reportId);
          if (!eligible.length) return;
          const senderName = isAnonymous ? 'Someone' : (saved.user?.name || 'Someone');
          return pushService.notifyUsers(
            eligible,
            'New message in report',
            `${senderName}: ${message.slice(0, 80)}`,
            { type: 'report_chat', reportId }
          );
        })
        .catch(() => {});

      return saved;
    } catch (error) {
      logger.error('Error in saveMessage (report):', error);
      throw error;
    }
  }

  async getReportMessages(reportId: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('report_messages')
        .select(`
          *,
          user:users (
            id,
            name,
            avatar_url
          )
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error getting report messages:', error);
        throw new Error('Failed to get messages');
      }

      return (data || []).reverse().map(maskAnonymousUser);
    } catch (error) {
      logger.error('Error in getReportMessages:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string) {
    try {
      const { data: message } = await supabaseAdmin
        .from('report_messages')
        .select('user_id')
        .eq('id', messageId)
        .single();

      if (!message || message.user_id !== userId) {
        throw forbidden();
      }

      const { error } = await supabaseAdmin
        .from('report_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        logger.error('Error deleting report message:', error);
        throw new Error('Failed to delete message');
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteMessage (report):', error);
      throw error;
    }
  }

  /**
   * Get unread message counts for a batch of reports for a given user.
   * Returns { [reportId]: unreadCount }
   */
  async getUnreadCounts(userId: string, reportIds: string[]): Promise<Record<string, number>> {
    if (!reportIds.length) return {};

    try {
      // Get last_read_at for each report for this user
      const { data: reads } = await supabaseAdmin
        .from('report_message_reads')
        .select('report_id, last_read_at')
        .eq('user_id', userId)
        .in('report_id', reportIds);

      const readMap: Record<string, string> = {};
      (reads || []).forEach((r: any) => {
        readMap[r.report_id] = r.last_read_at;
      });

      // For each report, count messages after last_read_at (or all messages if never read)
      const counts: Record<string, number> = {};

      await Promise.all(
        reportIds.map(async (reportId) => {
          try {
            const lastRead = readMap[reportId];
            let query = supabaseAdmin
              .from('report_messages')
              .select('id', { count: 'exact', head: true })
              .eq('report_id', reportId)
              .neq('user_id', userId); // Don't count own messages

            if (lastRead) {
              query = query.gt('created_at', lastRead);
            }

            const { count } = await query;
            counts[reportId] = count ?? 0;
          } catch {
            counts[reportId] = 0;
          }
        })
      );

      return counts;
    } catch (error) {
      logger.error('Error in getUnreadCounts:', error);
      return {};
    }
  }

  /**
   * Mark all messages in a report as read for a user.
   */
  async markAsRead(reportId: string, userId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('report_message_reads')
        .upsert(
          { report_id: reportId, user_id: userId, last_read_at: new Date().toISOString() },
          { onConflict: 'report_id,user_id' }
        );

      if (error) {
        logger.error('Error marking report as read:', error);
      }
    } catch (error) {
      logger.error('Error in markAsRead:', error);
    }
  }
}

export default new ReportChatService();
