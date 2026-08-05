import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'), // 60 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Credential endpoints (login, signup, refresh, password reset). Tight enough
// to make online password guessing impractical without hurting real users.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts. Please wait a few minutes and try again.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count, so a user logging in repeatedly across devices
  // is unaffected while brute-force attempts still exhaust the budget.
  skipSuccessfulRequests: true
});

// Stricter limiter for AI/search endpoints
export const searchLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many search requests, please try again later'
    }
  }
});

// Stricter limiter for pin creation (prevents spam creation)
export const pinCreateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // 5 pin creations per minute per IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'You are creating pins too quickly, please wait a moment'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 uploads per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload requests, please try again later'
    }
  }
});
