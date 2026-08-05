import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  signup,
  login,
  refreshToken,
  getCurrentUser,
  logout,
  checkUsername,
  requestPasswordReset,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authLimiter, apiLimiter } from '../middleware/rateLimiter';
import { runValidation } from '../middleware/validator';

const router = Router();

// Credential endpoints are the most attacked surface in the app, so they get a
// tighter budget than the app-wide default.
router.post(
  '/signup',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('username').optional({ values: 'falsy' }).trim().isLength({ min: 3, max: 30 }),
  ],
  runValidation,
  signup
);

router.post(
  '/login',
  authLimiter,
  [
    body('identifier').trim().notEmpty().withMessage('Email or username required'),
    body('password').notEmpty(),
  ],
  runValidation,
  login
);

router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  runValidation,
  requestPasswordReset
);

router.post('/refresh', authLimiter, refreshToken);

router.get(
  '/username-available',
  apiLimiter,
  [query('username').trim().isLength({ min: 3, max: 30 })],
  runValidation,
  checkUsername
);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
