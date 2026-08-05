import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { createAuthedSocket } from '../lib/socket';
import { reportChatAPI } from '../services/api';

interface Message {
  id: string;
  report_id: string;
  user_id: string;
  message: string;
  is_anonymous: boolean;
  created_at: string;
  user: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export function useReportChat(reportId: string, isAnonymous: boolean = false) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const loaded = await reportChatAPI.getMessages(reportId);
      setMessages(loaded);
      setError(null);
    } catch (err) {
      console.warn('Error loading report messages:', err);
      setError('Could not load earlier messages.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;

    setLoading(true);
    const socket = createAuthedSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-report', reportId);
      // Re-sync on every (re)connect so messages missed while offline appear.
      void loadMessages();
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', () => {
      setConnected(false);
      setLoading(false);
    });

    socket.on('new-report-message', (message: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });

    socket.on('user-typing-report', ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(userId));
    });

    socket.on('user-stopped-typing-report', ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('leave-report', reportId);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [reportId, loadMessages]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!socketRef.current || !trimmed) return;
      socketRef.current.emit('send-report-message', {
        reportId,
        text: trimmed,
        isAnonymous,
      });
    },
    [reportId, isAnonymous]
  );

  const stopTyping = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('typing-stop-report', { reportId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [reportId]);

  const startTyping = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('typing-start-report', { reportId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 3000);
  }, [reportId, stopTyping]);

  return {
    messages,
    loading,
    error,
    connected,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    startTyping,
    stopTyping,
    reload: loadMessages,
  };
}
