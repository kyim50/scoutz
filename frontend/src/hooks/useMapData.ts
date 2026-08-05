import { useState, useCallback, useRef } from 'react';
import { pinAPI, eventAPI, reportAPI, eventChatAPI } from '../services/api';

type Coords = [number, number]; // [lng, lat], matching Mapbox ordering

export type MapDataKind = 'pins' | 'events' | 'reports' | 'search';

interface UseMapDataOptions {
  mode: 'campus' | 'open_world';
  /** Filters out items belonging to groups the user isn't viewing. */
  groupFilter: (item: any) => boolean;
  /** Whether to fetch chat unread counts (requires a signed-in user). */
  trackUnread: boolean;
}

/**
 * Owns the map's nearby data: pins, events, reports and the "for you" set.
 *
 * Extracted from MapScreen, where these four loaders and their state were
 * tangled with sheet, search and navigation logic. Beyond shrinking that file,
 * this adds the thing the loaders never had: a record of whether the last fetch
 * failed. Previously an error was logged and the state left empty, so a failed
 * load was indistinguishable from "nothing nearby" and offered no way back.
 */
export function useMapData({ mode, groupFilter, trackUnread }: UseMapDataOptions) {
  const [pins, setPins] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [forYouPins, setForYouPins] = useState<any[]>([]);
  const [eventUnreadCounts, setEventUnreadCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  /** Non-null when the most recent refresh failed outright. */
  const [error, setError] = useState<'offline' | 'server' | null>(null);

  const lastLocation = useRef<Coords | null>(null);
  const lastMode = useRef(mode);

  /**
   * Search radius in metres. Campus mode searches tighter than open-world, and
   * an urgent-sounding query tightens it further so the closest option wins.
   */
  const getAdaptiveRadius = useCallback(
    (kind: MapDataKind, queryText?: string) => {
      const query = String(queryText || '').toLowerCase();
      const urgent = /(now|urgent|asap|quick|nearest|closest)/.test(query);

      const campus = {
        pins: urgent ? 850 : 1100,
        events: 2500,
        reports: 900,
        search: urgent ? 1400 : 1900,
      };
      const open = {
        pins: urgent ? 1700 : 2400,
        events: 5200,
        reports: 2100,
        search: urgent ? 2200 : 3000,
      };

      return mode === 'campus' ? campus[kind] : open[kind];
    },
    [mode]
  );

  const loadNearbyPins = useCallback(
    async (location: Coords) => {
      const response = await pinAPI.getNearby(location[1], location[0], getAdaptiveRadius('pins'));
      if (response.success) setPins(response.data.pins || []);
    },
    [getAdaptiveRadius]
  );

  const loadNearbyEvents = useCallback(
    async (location: Coords) => {
      const response = await eventAPI.getUpcoming(
        location[1],
        location[0],
        getAdaptiveRadius('events')
      );
      if (!response.success) return;

      const nearby = response.data.events || [];
      setEvents(nearby);

      if (!trackUnread || nearby.length === 0) {
        setEventUnreadCounts({});
        return;
      }

      // Unread counts are decoration — never let them fail the whole refresh.
      const ids = nearby.map((e: any) => e.id).filter(Boolean);
      eventChatAPI.getUnreadCounts(ids).then(setEventUnreadCounts).catch(() => {});
    },
    [getAdaptiveRadius, trackUnread]
  );

  const loadNearbyReports = useCallback(
    async (location: Coords) => {
      const response = await reportAPI.getNearby(
        location[1],
        location[0],
        getAdaptiveRadius('reports')
      );
      const loaded = response?.data?.reports || response?.reports || [];
      setReports(Array.isArray(loaded) ? loaded : []);
    },
    [getAdaptiveRadius]
  );

  const loadForYouPins = useCallback(
    async (location: Coords) => {
      const response = await pinAPI.getForYou(location[1], location[0], getAdaptiveRadius('pins'));
      if (response.success) setForYouPins((response.data.pins || []).filter(groupFilter));
    },
    [getAdaptiveRadius, groupFilter]
  );

  /**
   * Refresh everything for a location.
   *
   * Pins, events and reports are the map's substance — if all three fail the
   * refresh is a failure and the UI should say so. "For you" is supplementary,
   * so its failure is ignored.
   */
  const loadAll = useCallback(
    async (location: Coords) => {
      lastLocation.current = location;
      lastMode.current = mode;
      setLoading(true);

      const results = await Promise.allSettled([
        loadNearbyPins(location),
        loadNearbyEvents(location),
        loadNearbyReports(location),
      ]);
      void loadForYouPins(location).catch(() => {});

      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

      if (failures.length === results.length) {
        const offline = failures.some((f) => !f.reason?.response);
        setError(offline ? 'offline' : 'server');
      } else {
        setError(null);
      }

      setLoading(false);
    },
    [mode, loadNearbyPins, loadNearbyEvents, loadNearbyReports, loadForYouPins]
  );

  /** Re-run the last refresh. Backs the retry button on the error state. */
  const retry = useCallback(() => {
    if (lastLocation.current) void loadAll(lastLocation.current);
  }, [loadAll]);

  return {
    pins,
    events,
    reports,
    forYouPins,
    eventUnreadCounts,
    loading,
    error,

    setPins,
    setEvents,
    setReports,
    setForYouPins,
    setEventUnreadCounts,

    getAdaptiveRadius,
    loadAll,
    loadNearbyPins,
    loadNearbyEvents,
    loadNearbyReports,
    loadForYouPins,
    retry,

    lastLocation,
    lastMode,
  };
}
