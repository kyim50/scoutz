import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import reputationService from './reputation.service';

export interface CreateReportData {
  type: 'hazard' | 'food_status' | 'campus_update' | 'safety' | 'accessibility' | 'general' | 'other';
  pinId?: string;
  lat: number;
  lng: number;
  content?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  isAnonymous?: boolean;
}

export interface GetReportsOptions {
  type?: string;
  limit?: number;
}

// Base TTL (ms) and max TTL (ms) per report type
// Activity extension: each new message resets expires_at to MIN(created_at + maxTtl, NOW() + extensionMs)
const TTL_CONFIG: Record<string, { baseTtlMs: number; maxTtlMs: number; extensionMs: number }> = {
  hazard:        { baseTtlMs: 24 * 3600_000,      maxTtlMs: 48 * 3600_000,       extensionMs: 12 * 3600_000 },
  general:       { baseTtlMs: 12 * 3600_000,      maxTtlMs: 24 * 3600_000,       extensionMs: 6 * 3600_000 },
  food_status:   { baseTtlMs: 6 * 3600_000,       maxTtlMs: 12 * 3600_000,       extensionMs: 3 * 3600_000 },
  safety:        { baseTtlMs: 48 * 3600_000,      maxTtlMs: 72 * 3600_000,       extensionMs: 12 * 3600_000 },
  campus_update: { baseTtlMs: 7 * 24 * 3600_000,  maxTtlMs: 14 * 24 * 3600_000,  extensionMs: 24 * 3600_000 },
  accessibility: { baseTtlMs: 3 * 24 * 3600_000,  maxTtlMs: 7 * 24 * 3600_000,   extensionMs: 12 * 3600_000 },
  other:         { baseTtlMs: 24 * 3600_000,      maxTtlMs: 48 * 3600_000,       extensionMs: 12 * 3600_000 },
};

function computeExpiresAt(type: string, createdAt: Date = new Date()): Date {
  const config = TTL_CONFIG[type] ?? TTL_CONFIG.other;
  return new Date(createdAt.getTime() + config.baseTtlMs);
}

export class ReportService {
  /**
   * Create a new report. Sets expires_at based on type TTL.
   */
  async createReport(userId: string, data: CreateReportData) {
    try {
      const { lat, lng } = data;
      if (lat == null || lng == null) {
        throw new Error('Latitude and longitude are required');
      }

      const content = data.content?.slice(0, 200) || null;
      const now = new Date();
      const expiresAt = computeExpiresAt(data.type, now);

      const { data: report, error } = await supabaseAdmin
        .from('reports')
        .insert({
          user_id: userId,
          type: data.type,
          pin_id: data.pinId || null,
          location: `POINT(${lng} ${lat})`,
          content,
          image_url: data.imageUrl || null,
          metadata: data.metadata || {},
          is_anonymous: data.isAnonymous || false,
          expires_at: expiresAt.toISOString(),
          last_activity_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating report:', error);
        throw new Error('Failed to create report');
      }

      logger.info('Report created:', { reportId: report.id, userId, type: data.type, expiresAt });

      // Award reputation for filing a report (skip anonymous reports)
      if (!data.isAnonymous) {
        await reputationService.award(userId, 'create_report');
      }

      return report;
    } catch (error) {
      logger.error('Error in createReport:', error);
      throw error;
    }
  }

  /**
   * Delete a report. Only the owner can delete it.
   */
  async deleteReport(reportId: string, userId: string) {
    try {
      const { data: report } = await supabaseAdmin
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single();

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabaseAdmin
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        logger.error('Error deleting report:', error);
        throw new Error('Failed to delete report');
      }

      logger.info('Report deleted:', { reportId, userId });
      return true;
    } catch (error) {
      logger.error('Error in deleteReport:', error);
      throw error;
    }
  }

  /**
   * Extend a report's expiry when a new chat message is posted.
   * New expires_at = MIN(created_at + maxTTL, NOW() + extensionMs)
   */
  async extendExpiry(reportId: string, reportType: string) {
    try {
      const config = TTL_CONFIG[reportType] ?? TTL_CONFIG.other;

      const { data: report } = await supabaseAdmin
        .from('reports')
        .select('created_at, expires_at')
        .eq('id', reportId)
        .single();

      if (!report) return;

      const createdAt = new Date(report.created_at).getTime();
      const maxExpiry = new Date(createdAt + config.maxTtlMs);
      const activityExpiry = new Date(Date.now() + config.extensionMs);
      const newExpiry = activityExpiry < maxExpiry ? activityExpiry : maxExpiry;
      const now = new Date();

      await supabaseAdmin
        .from('reports')
        .update({
          expires_at: newExpiry.toISOString(),
          last_activity_at: now.toISOString(),
        })
        .eq('id', reportId);
    } catch (error) {
      // Non-critical: log but don't throw — chat message still succeeds
      logger.error('Error extending report expiry:', error);
    }
  }

  /**
   * Get reports near a location (non-expired only).
   */
  async getReportsNearby(
    lat: number,
    lng: number,
    radius = 500,
    options: GetReportsOptions = {},
    userId?: string,
  ) {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_nearby_reports', {
        p_lat: lat,
        p_lng: lng,
        radius_meters: radius,
        report_type: options.type || null,
        limit_count: options.limit || 50,
        p_user_id: userId || null,
      });

      if (error) {
        logger.error('Error fetching nearby reports:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          params: { lat, lng, radius, type: options.type }
        });
        throw new Error(`Failed to fetch reports: ${error.message || 'Unknown error'}`);
      }

      // Filter out expired reports (RPC doesn't have expires_at in return type yet)
      const now = new Date().toISOString();
      return (data || []).filter((r: any) => !r.expires_at || r.expires_at > now);
    } catch (error) {
      logger.error('Error in getReportsNearby:', error);
      throw error;
    }
  }

  /**
   * Get reports attached to a specific pin (non-expired only, sorted by activity).
   */
  async getReportsByPin(pinId: string) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('reports')
        .select('*')
        .eq('pin_id', pinId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('last_activity_at', { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Error fetching reports by pin:', error);
        throw new Error('Failed to fetch reports');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getReportsByPin:', error);
      throw error;
    }
  }

  /**
   * Delete all reports whose expires_at has passed.
   */
  async cleanupExpiredReports() {
    try {
      const now = new Date().toISOString();
      const { data: deleted, error } = await supabaseAdmin
        .from('reports')
        .delete()
        .lt('expires_at', now)
        .not('expires_at', 'is', null)
        .select('id');

      if (error) {
        logger.error('Error cleaning up expired reports:', error);
        return;
      }

      if (deleted && deleted.length > 0) {
        logger.info(`Deleted ${deleted.length} expired reports`);
      }
    } catch (error) {
      logger.error('Error in cleanupExpiredReports:', error);
    }
  }
}

export default new ReportService();
