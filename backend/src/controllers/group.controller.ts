import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import groupService from '../services/group.service';
import { sendSuccess, sendError } from '../utils/response';

// POST /api/groups
export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const group = await groupService.createGroup(req.user.id, req.body.name);
    return sendSuccess(res, { group }, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_FAILED', 'Failed to create group', 500);
  }
};

// GET /api/groups
export const getUserGroups = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const groups = await groupService.getUserGroups(req.user.id);
    return sendSuccess(res, { groups });
  } catch (error: any) {
    return sendError(res, 'FETCH_FAILED', 'Failed to fetch groups', 500);
  }
};

// GET /api/groups/:id
export const getGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const group = await groupService.getGroupById(req.params.id, req.user.id);
    if (!group) return sendError(res, 'NOT_FOUND', 'Group not found or you are not a member', 404);
    return sendSuccess(res, { group });
  } catch (error: any) {
    return sendError(res, 'FETCH_FAILED', 'Failed to fetch group', 500);
  }
};

// PATCH /api/groups/:id
export const renameGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const group = await groupService.renameGroup(req.params.id, req.user.id, req.body.name);
    return sendSuccess(res, { group });
  } catch (error: any) {
    return sendError(res, 'UPDATE_FAILED', error.message || 'Failed to rename group', 400);
  }
};

// DELETE /api/groups/:id
export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    await groupService.deleteGroup(req.params.id, req.user.id);
    return sendSuccess(res, { deleted: true });
  } catch (error: any) {
    return sendError(res, 'DELETE_FAILED', error.message || 'Failed to delete group', 400);
  }
};

// POST /api/groups/:id/members  { username }
export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const user = await groupService.addMemberByUsername(req.params.id, req.user.id, req.body.username);
    return sendSuccess(res, { user }, 201);
  } catch (error: any) {
    const code = error.code;
    if (code === 'FORBIDDEN')      return sendError(res, 'FORBIDDEN',      error.message, 403);
    if (code === 'USER_NOT_FOUND') return sendError(res, 'USER_NOT_FOUND', error.message, 404);
    if (code === 'ALREADY_MEMBER') return sendError(res, 'ALREADY_MEMBER', error.message, 409);
    return sendError(res, 'ADD_FAILED', 'Failed to add member', 500);
  }
};

// DELETE /api/groups/:id/members/:userId
export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    await groupService.removeMember(req.params.id, req.user.id, req.params.userId);
    return sendSuccess(res, { removed: true });
  } catch (error: any) {
    const code = error.code;
    if (code === 'FORBIDDEN')   return sendError(res, 'FORBIDDEN',   error.message, 403);
    if (code === 'OWNER_LEAVE') return sendError(res, 'OWNER_LEAVE', error.message, 400);
    return sendError(res, 'REMOVE_FAILED', 'Failed to remove member', 500);
  }
};

// POST /api/groups/:id/invite/refresh
export const refreshInviteCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const inviteCode = await groupService.refreshInviteCode(req.params.id, req.user.id);
    return sendSuccess(res, { inviteCode });
  } catch (error: any) {
    return sendError(res, 'REFRESH_FAILED', 'Failed to refresh invite code', 500);
  }
};

// POST /api/groups/join/:inviteCode
export const joinGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    const group = await groupService.joinByInviteCode(req.params.inviteCode, req.user.id);
    return sendSuccess(res, { group }, 201);
  } catch (error: any) {
    const code = error.code;
    if (code === 'INVALID_CODE')  return sendError(res, 'INVALID_CODE',  error.message, 404);
    if (code === 'ALREADY_MEMBER') return sendError(res, 'ALREADY_MEMBER', error.message, 409);
    return sendError(res, 'JOIN_FAILED', 'Failed to join group', 500);
  }
};
