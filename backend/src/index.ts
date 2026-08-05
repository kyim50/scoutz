import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import pinRoutes from './routes/pin.routes';
import eventRoutes from './routes/event.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import savedRoutes from './routes/saved.routes';
import reviewRoutes from './routes/review.routes';
import areaRoutes from './routes/area.routes';
import reportRoutes from './routes/report.routes';
import reportChatRoutes from './routes/reportChat.routes';
import recommendationRoutes from './routes/recommendation.routes';
import groupRoutes from './routes/group.routes';
import logger from './utils/logger';
import socketService from './services/socket.service';
import schedulerService from './services/scheduler.service';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Trust Railway's proxy so express-rate-limit keys on the real client IP
// rather than the load balancer's.
app.set('trust proxy', 1);

// Native app requests send no Origin header, so `!origin` is allowed through;
// browser origins must be listed in CORS_ALLOWED_ORIGINS (comma-separated).
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } })); // Logging

// Baseline rate limit across every API route. Individual routers layer stricter
// limits on top (auth, search, uploads, pin creation).
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/pins', pinRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/reports', reportRoutes);
// Mounted on its own prefix: the client calls /api/report-chats/*, and sharing
// /api/reports meant `GET /unread` was swallowed by reportRoutes' `GET /:reportId`.
app.use('/api/report-chats', reportChatRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/groups', groupRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8081',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

socketService.initialize(io);

// Initialize scheduler service
schedulerService.start();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  schedulerService.stop();
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`WebSocket server initialized`);
  logger.info(`Scheduler service running`);
});

export default app;
