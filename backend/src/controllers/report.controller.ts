import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import reportService from '../services/report.service';
import reportClusterService from '../services/reportCluster.service';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';

export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { type, pinId, lat, lng, content, imageUrl, metadata, isAnonymous, groupId } = req.body;

    if (!type || !['hazard', 'food_status', 'campus_update', 'safety', 'accessibility', 'general', 'other'].includes(type)) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid type is required', 400);
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return sendError(res, 'VALIDATION_ERROR', 'Latitude and longitude are required', 400);
    }

    const report = await reportService.createReport(userId, {
      type,
      pinId: pinId || undefined,
      lat,
      lng,
      content: content || undefined,
      imageUrl: imageUrl || undefined,
      metadata: metadata || undefined,
      isAnonymous: isAnonymous || false,
      groupId: groupId || undefined,
    });

    return sendSuccess(res, report);
  } catch (error: any) {
    logger.error('Create report error:', error);
    return sendError(res, 'REPORT_FAILED', error.message || 'Failed to create report', 500);
  }
};

export const getReportById = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { data, error } = await (await import('../config/supabase')).supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (error || !data) {
      return sendError(res, 'NOT_FOUND', 'Report not found', 404);
    }
    return sendSuccess(res, { report: data });
  } catch (error) {
    return sendError(res, 'GET_FAILED', 'Failed to get report', 500);
  }
};

export const getReportsNearby = async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const MIN_RADIUS = 5000; // enforce at least 5 km regardless of what the client sends
    const radius = Math.max(req.query.radius ? parseInt(req.query.radius as string) : MIN_RADIUS, MIN_RADIUS);
    const type = req.query.type as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid lat and lng are required', 400);
    }

    const reports = await reportService.getReportsNearby(lat, lng, radius, { type }, req.user?.id);
    return sendSuccess(res, { reports });
  } catch (error: any) {
    logger.error('Get reports error:', error);
    return sendError(res, 'REPORT_FETCH_FAILED', 'Failed to fetch reports', 500);
  }
};

export const getReportsByPin = async (req: AuthRequest, res: Response) => {
  try {
    const { pinId } = req.params;
    if (!pinId) {
      return sendError(res, 'VALIDATION_ERROR', 'Pin ID is required', 400);
    }

    const reports = await reportService.getReportsByPin(pinId);
    return sendSuccess(res, { reports });
  } catch (error: any) {
    logger.error('Get reports by pin error:', error);
    return sendError(res, 'REPORT_FETCH_FAILED', 'Failed to fetch reports', 500);
  }
};

export const deleteReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { reportId } = req.params;
    if (!reportId) {
      return sendError(res, 'VALIDATION_ERROR', 'Report ID is required', 400);
    }

    await reportService.deleteReport(reportId, userId);
    return sendSuccess(res, { message: 'Report deleted successfully' });
  } catch (error: any) {
    logger.error('Delete report error:', error);
    if (error.message === 'Unauthorized') {
      return sendError(res, 'FORBIDDEN', 'Not authorized to delete this report', 403);
    }
    if (error.message === 'Report not found') {
      return sendError(res, 'NOT_FOUND', 'Report not found', 404);
    }
    return sendError(res, 'DELETE_FAILED', 'Failed to delete report', 500);
  }
};

export const getReportsNearbyClustered = async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const MIN_RADIUS = 5000; // enforce at least 5 km regardless of what the client sends
    const radius = Math.max(req.query.radius ? parseInt(req.query.radius as string) : MIN_RADIUS, MIN_RADIUS);
    const type = req.query.type as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid lat and lng are required', 400);
    }

    const reports = await reportService.getReportsNearby(lat, lng, radius, { type }, req.user?.id);
    const rawReports = (reports || []).map((r: any) => ({
      ...r,
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
    }));

    const result = await reportClusterService.clusterAndFilterReports(rawReports);
    return sendSuccess(res, result);
  } catch (error: any) {
    logger.error('Get clustered reports error:', error);
    return sendError(res, 'REPORT_FETCH_FAILED', 'Failed to fetch reports', 500);
  }
};
