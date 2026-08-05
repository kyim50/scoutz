/**
 * Route-table regression tests.
 *
 * BUG-02 in the audit was two stacked routing mistakes: the client called
 * /api/report-chats/* while the router was mounted at /api/reports, and even at
 * the right prefix `GET /unread` was shadowed by `GET /:reportId` from the
 * router mounted ahead of it. Both are shape-of-the-route-table problems that a
 * request-level test catches immediately.
 */

const mockGetUnreadCounts = jest.fn();
const mockGetReportById = jest.fn();

jest.mock('../controllers/reportChat.controller', () => ({
  getUnreadCounts: (_req: unknown, res: any) => {
    mockGetUnreadCounts();
    return res.json({ success: true, data: { counts: {} }, handler: 'reportChat.getUnreadCounts' });
  },
  markAsRead: (_req: unknown, res: any) => res.json({ success: true }),
  getReportMessages: (_req: unknown, res: any) =>
    res.json({ success: true, data: { messages: [] }, handler: 'reportChat.getReportMessages' }),
  deleteReportMessage: (_req: unknown, res: any) => res.json({ success: true }),
}));

jest.mock('../controllers/report.controller', () => ({
  createReport: (_req: unknown, res: any) => res.json({ success: true }),
  getReportsNearby: (_req: unknown, res: any) => res.json({ success: true }),
  getReportsNearbyClustered: (_req: unknown, res: any) => res.json({ success: true }),
  getReportsByPin: (_req: unknown, res: any) => res.json({ success: true }),
  getReportById: (req: any, res: any) => {
    mockGetReportById(req.params.reportId);
    return res.json({ success: true, handler: 'report.getReportById' });
  },
  deleteReport: (_req: unknown, res: any) => res.json({ success: true }),
}));

// Authenticate every request as a fixed user so these tests exercise routing
// rather than auth.
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', email: 'ada@example.com' };
    next();
  },
  optionalAuthenticate: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', email: 'ada@example.com' };
    next();
  },
  verifyAccessToken: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import reportRoutes from '../routes/report.routes';
import reportChatRoutes from '../routes/reportChat.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  // Mount order mirrors src/index.ts.
  app.use('/api/reports', reportRoutes);
  app.use('/api/report-chats', reportChatRoutes);
  return app;
}

describe('report chat routing (BUG-02)', () => {
  const app = buildApp();

  it('serves unread counts at the path the client actually calls', async () => {
    const res = await request(app).get('/api/report-chats/unread?reportIds=a,b');

    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('reportChat.getUnreadCounts');
  });

  it('serves report chat message history', async () => {
    const res = await request(app).get('/api/report-chats/report-123/messages');

    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('reportChat.getReportMessages');
  });

  it('does not let GET /:reportId swallow the literal "unread" segment', async () => {
    await request(app).get('/api/report-chats/unread');

    // The regression: "unread" reaching getReportById as an id.
    expect(mockGetReportById).not.toHaveBeenCalledWith('unread');
    expect(mockGetUnreadCounts).toHaveBeenCalled();
  });

  it('still resolves a real report id on the reports router', async () => {
    const res = await request(app).get('/api/reports/report-123');

    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('report.getReportById');
    expect(mockGetReportById).toHaveBeenCalledWith('report-123');
  });

  it('404s the old mount point so a stale client fails loudly', async () => {
    const res = await request(app).get('/api/reports/unread/messages');

    expect(res.status).toBe(404);
  });
});
