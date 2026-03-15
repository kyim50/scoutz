import { Router } from 'express';
import Joi from 'joi';
import {
  createGroup,
  getUserGroups,
  getGroup,
  renameGroup,
  deleteGroup,
  addMember,
  removeMember,
  refreshInviteCode,
  joinGroup,
} from '../controllers/group.controller';
import { authenticate } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';

const router = Router();
router.use(apiLimiter);
router.use(authenticate);

const createGroupSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
});

const renameGroupSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
});

const addMemberSchema = Joi.object({
  username: Joi.string().min(1).max(50).required(),
});

// Groups CRUD
router.post('/',    validate(createGroupSchema), createGroup);
router.get('/',    getUserGroups);
router.get('/:id', getGroup);
router.patch('/:id', validate(renameGroupSchema), renameGroup);
router.delete('/:id', deleteGroup);

// Members
router.post(  '/:id/members',            validate(addMemberSchema), addMember);
router.delete('/:id/members/:userId',    removeMember);

// Invite
router.post('/:id/invite/refresh',       refreshInviteCode);
router.post('/join/:inviteCode',         joinGroup);

export default router;
