import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';
import { verifyAccessToken } from '../middleware/auth';
import chatService from './chat.service';
import reportChatService from './reportChat.service';
import { supabaseAdmin } from '../config/supabase';
import groupService from './group.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

/** Longest chat message we accept, matching the reports content cap. */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * A room is readable if the item is public (no group_id), or if the user
 * belongs to the group that owns it. Without this check any authenticated
 * user could join any event/report room and read private group chatter.
 */
async function canAccess(
  table: 'events' | 'reports',
  id: string,
  userId: string
): Promise<boolean> {
  if (!id || typeof id !== 'string') return false;
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('group_id')
      .eq('id', id)
      .single();

    if (error || !data) return false;
    if (!data.group_id) return true;
    return await groupService.isMember(data.group_id, userId);
  } catch (err) {
    logger.error(`Error checking ${table} room access:`, err);
    return false;
  }
}

export class SocketService {
  private io: Server | null = null;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  initialize(io: Server) {
    this.io = io;
    this.setupMiddleware();
    this.setupConnectionHandlers();
    logger.info('Socket.IO initialized');
  }

  private setupMiddleware() {
    if (!this.io) return;

    // Authentication middleware. Runs on every connect AND every reconnect,
    // so a client that re-reads its token picks up a refreshed one here.
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const user = await verifyAccessToken(token);
        if (!user) {
          // Signalled distinctly so the client knows to refresh and retry
          // rather than treating it as a permanent failure.
          return next(new Error('TOKEN_EXPIRED'));
        }
        socket.userId = user.id;
        return next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        return next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupConnectionHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User connected: ${socket.userId} (${socket.id})`);
      
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
      }

      // Join event room
      socket.on('join-event', async (eventId: string) => {
        if (!socket.userId || !(await canAccess('events', eventId, socket.userId))) {
          socket.emit('error', { message: 'Cannot join this event chat' });
          return;
        }

        socket.join(`event:${eventId}`);
        logger.info(`User ${socket.userId} joined event ${eventId}`);

        // Notify others in the room
        socket.to(`event:${eventId}`).emit('user-joined', {
          userId: socket.userId,
          eventId,
        });
      });

      // Leave event room
      socket.on('leave-event', (eventId: string) => {
        socket.leave(`event:${eventId}`);
        logger.info(`User ${socket.userId} left event ${eventId}`);
        
        socket.to(`event:${eventId}`).emit('user-left', {
          userId: socket.userId,
          eventId,
        });
      });

      // Handle chat messages
      socket.on('send-message', async (data: { eventId: string; text: string; isAnonymous?: boolean }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const text = typeof data?.text === 'string' ? data.text.trim() : '';
          if (!text || text.length > MAX_MESSAGE_LENGTH) {
            socket.emit('error', { message: 'Message must be 1-1000 characters' });
            return;
          }

          // Re-check on send: a client can emit without ever joining the room.
          if (!(await canAccess('events', data.eventId, socket.userId))) {
            socket.emit('error', { message: 'Cannot post to this event chat' });
            return;
          }

          const message = await chatService.saveMessage(
            data.eventId,
            socket.userId,
            text,
            data.isAnonymous || false
          );

          this.io!.to(`event:${data.eventId}`).emit('new-message', message);
        } catch (error) {
          logger.error('Error handling chat message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing-start', (data: { eventId: string }) => {
        socket.to(`event:${data.eventId}`).emit('user-typing', {
          userId: socket.userId,
          eventId: data.eventId,
        });
      });

      socket.on('typing-stop', (data: { eventId: string }) => {
        socket.to(`event:${data.eventId}`).emit('user-stopped-typing', {
          userId: socket.userId,
          eventId: data.eventId,
        });
      });

      // Handle feed posts
      socket.on('new-post', (data: { eventId: string; postId: string }) => {
        socket.to(`event:${data.eventId}`).emit('feed-post-added', {
          eventId: data.eventId,
          postId: data.postId,
        });
      });

      socket.on('new-reaction', (data: { eventId: string; postId: string; reactionType: string }) => {
        socket.to(`event:${data.eventId}`).emit('feed-reaction-added', data);
      });

      // --- Report chat rooms ---

      socket.on('join-report', async (reportId: string) => {
        if (!socket.userId || !(await canAccess('reports', reportId, socket.userId))) {
          socket.emit('error', { message: 'Cannot join this report chat' });
          return;
        }

        socket.join(`report:${reportId}`);
        logger.info(`User ${socket.userId} joined report chat ${reportId}`);
      });

      socket.on('leave-report', (reportId: string) => {
        socket.leave(`report:${reportId}`);
        logger.info(`User ${socket.userId} left report chat ${reportId}`);
      });

      socket.on('send-report-message', async (data: { reportId: string; text: string; isAnonymous?: boolean }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const text = typeof data?.text === 'string' ? data.text.trim() : '';
          if (!text || text.length > MAX_MESSAGE_LENGTH) {
            socket.emit('error', { message: 'Message must be 1-1000 characters' });
            return;
          }

          if (!(await canAccess('reports', data.reportId, socket.userId))) {
            socket.emit('error', { message: 'Cannot post to this report chat' });
            return;
          }

          const message = await reportChatService.saveMessage(
            data.reportId,
            socket.userId,
            text,
            data.isAnonymous || false
          );

          this.io!.to(`report:${data.reportId}`).emit('new-report-message', message);
        } catch (error) {
          logger.error('Error handling report chat message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('typing-start-report', (data: { reportId: string }) => {
        socket.to(`report:${data.reportId}`).emit('user-typing-report', {
          userId: socket.userId,
          reportId: data.reportId,
        });
      });

      socket.on('typing-stop-report', (data: { reportId: string }) => {
        socket.to(`report:${data.reportId}`).emit('user-stopped-typing-report', {
          userId: socket.userId,
          reportId: data.reportId,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.userId} (${socket.id})`);
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
      });
    });
  }

  // Utility methods
  broadcastNewPin(pin: any) {
    if (this.io) {
      this.io.emit('new-pin', pin);
    }
  }

  broadcastDeletedPin(pinId: string) {
    if (this.io) {
      this.io.emit('pin-deleted', { id: pinId });
    }
  }

  emitToEvent(eventId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`event:${eventId}`).emit(event, data);
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }

  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

export default new SocketService();
