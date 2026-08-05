import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from '../constants/api';
import { getAccessToken } from './supabase';

/**
 * Create a Socket.IO connection that survives access-token expiry.
 *
 * `auth` is given as a callback rather than a captured string. Socket.IO calls
 * it on every connect AND every reconnect, so each attempt sends a freshly
 * refreshed token. Passing a token value directly (the previous approach) meant
 * the socket replayed a token captured at mount — once it expired, every
 * reconnect failed authentication and real-time features died silently.
 */
export function createAuthedSocket(): Socket {
  return io(API_ORIGIN, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    // Back off rather than hammering a server that is down.
    reconnectionDelayMax: 10000,
    // Unlimited: a transient outage should not permanently kill live updates.
    reconnectionAttempts: Infinity,
    auth: (cb) => {
      getAccessToken()
        .then((token) => cb({ token: token ?? '' }))
        .catch(() => cb({ token: '' }));
    },
  });
}
