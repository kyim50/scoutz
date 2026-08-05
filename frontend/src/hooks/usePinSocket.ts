import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { createAuthedSocket } from '../lib/socket';

interface UsePinSocketOptions {
  onNewPin: (pin: any) => void;
  onPinDeleted: (pinId: string) => void;
  enabled?: boolean;
}

/**
 * Listens for real-time pin events. Server broadcasts reach every connected
 * client, so the map stays live without polling.
 */
export function usePinSocket({ onNewPin, onPinDeleted, enabled = true }: UsePinSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Held in refs so a caller passing inline handlers doesn't tear down and
  // rebuild the socket on every render.
  const onNewPinRef = useRef(onNewPin);
  const onPinDeletedRef = useRef(onPinDeleted);
  onNewPinRef.current = onNewPin;
  onPinDeletedRef.current = onPinDeleted;

  useEffect(() => {
    if (!enabled) return;

    const socket = createAuthedSocket();
    socketRef.current = socket;

    socket.on('new-pin', (pin: any) => onNewPinRef.current(pin));
    socket.on('pin-deleted', ({ id }: { id: string }) => onPinDeletedRef.current(id));

    socket.on('connect_error', (err) => {
      // The auth callback re-reads the token on the next attempt, so an expired
      // token resolves itself. Anything else is worth surfacing in dev.
      if (__DEV__ && err.message !== 'TOKEN_EXPIRED') {
        console.warn('Pin socket connection error:', err.message);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);
}
