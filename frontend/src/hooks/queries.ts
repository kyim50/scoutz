import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { queryKeys } from '../lib/queryClient';
import { savedAPI, pinAPI, eventAPI, reportAPI, userAPI, groupAPI, reviewAPI } from '../services/api';

/**
 * React Query hooks for the app's read paths.
 *
 * These replace hand-rolled useState/useEffect fetching, which had no caching,
 * no request deduplication, no background refetch, and left stale data on
 * screen after mutations.
 */

/** True when the failure is a connectivity problem rather than a server error. */
export function isOfflineError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

// ─── Saved items ────────────────────────────────────────────────────────────

export function useSavedItems(itemType?: 'pin' | 'event') {
  return useQuery({
    queryKey: queryKeys.saved(itemType),
    queryFn: async () => {
      const response = await savedAPI.getSavedItems(itemType);
      return (response?.data?.items ?? response?.data?.savedItems ?? []) as any[];
    },
  });
}

export function useToggleSaved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      saved,
    }: {
      itemType: 'pin' | 'event';
      itemId: string;
      saved: boolean;
    }) => {
      if (saved) {
        await savedAPI.unsaveItem(itemType, itemId);
      } else {
        await savedAPI.saveItem(itemType, itemId);
      }
      return { itemType, itemId, saved: !saved };
    },
    onSuccess: ({ itemType, itemId, saved }) => {
      // Every list that could show this item, plus the item's own status.
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.setQueryData(queryKeys.savedStatus(itemType, itemId), saved);
    },
  });
}

// ─── Map data ───────────────────────────────────────────────────────────────

interface Coords {
  lat: number;
  lng: number;
}

export function useNearbyPins(location: Coords | null, radius: number) {
  return useQuery({
    queryKey: location ? queryKeys.nearbyPins(location.lat, location.lng, radius) : ['pins', 'nearby', 'idle'],
    // Nothing to fetch until we know where the user is.
    enabled: Boolean(location),
    queryFn: async () => {
      const response = await pinAPI.getNearby(location!.lat, location!.lng, radius);
      return (response?.data?.pins ?? []) as any[];
    },
  });
}

export function useNearbyReports(location: Coords | null, radius: number, type?: string) {
  return useQuery({
    queryKey: location
      ? queryKeys.nearbyReports(location.lat, location.lng, radius, type)
      : ['reports', 'nearby', 'idle'],
    enabled: Boolean(location),
    queryFn: async () => {
      const response = await reportAPI.getNearby(location!.lat, location!.lng, radius, type);
      return (response?.data?.reports ?? []) as any[];
    },
    // Reports are the most time-sensitive thing on the map.
    staleTime: 15_000,
  });
}

export function useUpcomingEvents(location: Coords | null, radius: number) {
  return useQuery({
    queryKey: location
      ? queryKeys.upcomingEvents(location.lat, location.lng, radius)
      : ['events', 'upcoming', 'idle'],
    enabled: Boolean(location),
    queryFn: async () => {
      const response = await eventAPI.getUpcoming(location!.lat, location!.lng, radius);
      return (response?.data?.events ?? []) as any[];
    },
  });
}

// ─── Detail views ───────────────────────────────────────────────────────────

export function usePin(pinId: string | null) {
  return useQuery({
    queryKey: queryKeys.pin(pinId ?? 'none'),
    enabled: Boolean(pinId),
    queryFn: async () => {
      const response = await pinAPI.getById(pinId!);
      return response?.data?.pin ?? response?.data ?? null;
    },
  });
}

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.event(eventId ?? 'none'),
    enabled: Boolean(eventId),
    queryFn: async () => {
      const response = await eventAPI.getById(eventId!);
      return response?.data?.event ?? response?.data ?? null;
    },
  });
}

export function useReviews(itemType: 'pin' | 'event', itemId: string | null) {
  return useQuery({
    queryKey: queryKeys.reviews(itemType, itemId ?? 'none'),
    enabled: Boolean(itemId),
    queryFn: async () => {
      const response = await reviewAPI.getReviews(itemType, itemId!);
      return (response?.data?.reviews ?? []) as any[];
    },
  });
}

// ─── Social ─────────────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups(),
    queryFn: async () => {
      const response = await groupAPI.getUserGroups();
      return (response?.data?.groups ?? []) as any[];
    },
  });
}

export function useGroup(groupId: string | null) {
  return useQuery({
    queryKey: queryKeys.group(groupId ?? 'none'),
    enabled: Boolean(groupId),
    queryFn: async () => {
      const response = await groupAPI.getGroup(groupId!);
      return response?.data?.group ?? null;
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard(),
    queryFn: async () => {
      const response = await userAPI.getLeaderboard();
      return (response?.data?.leaders ?? []) as any[];
    },
    // Rankings move slowly; no need to refetch aggressively.
    staleTime: 5 * 60_000,
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'none'),
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await userAPI.getProfile(userId!);
      return response?.data?.user ?? null;
    },
  });
}
