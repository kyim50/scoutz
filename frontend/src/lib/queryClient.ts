import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Shared query client.
 *
 * Defaults are tuned for a map app on a phone: data goes stale quickly because
 * it is location-dependent, but retries stay conservative so a genuinely
 * offline device fails fast and shows a retry affordance rather than spinning.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Don't burn retries on errors that will never succeed on their own.
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status && status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Stable key factory. Centralised so invalidation after a mutation can't drift
 * out of sync with the keys the queries actually use.
 */
export const queryKeys = {
  saved: (itemType?: 'pin' | 'event') => ['saved', itemType ?? 'all'] as const,
  savedStatus: (itemType: 'pin' | 'event', itemId: string) =>
    ['saved', 'status', itemType, itemId] as const,

  nearbyPins: (lat: number, lng: number, radius: number) =>
    ['pins', 'nearby', round(lat), round(lng), radius] as const,
  forYouPins: (lat: number, lng: number, radius: number) =>
    ['pins', 'forYou', round(lat), round(lng), radius] as const,
  pin: (id: string) => ['pins', id] as const,

  nearbyReports: (lat: number, lng: number, radius: number, type?: string) =>
    ['reports', 'nearby', round(lat), round(lng), radius, type ?? 'all'] as const,
  report: (id: string) => ['reports', id] as const,

  upcomingEvents: (lat: number, lng: number, radius: number) =>
    ['events', 'upcoming', round(lat), round(lng), radius] as const,
  event: (id: string) => ['events', id] as const,

  reviews: (itemType: 'pin' | 'event', itemId: string) =>
    ['reviews', itemType, itemId] as const,

  groups: () => ['groups'] as const,
  group: (id: string) => ['groups', id] as const,

  profile: (userId: string) => ['users', userId] as const,
  leaderboard: () => ['users', 'leaderboard'] as const,
} as const;

/**
 * Quantise coordinates to ~11m so small GPS jitter reuses the cached result
 * instead of minting a new cache entry on every location update.
 */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
