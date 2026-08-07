import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { userAPI } from '../services/api';
import LocationThumbnail from '../components/LocationThumbnail';
import { AvatarRowSkeleton } from '../components/Skeleton';

type ActivityKind = 'pin' | 'report' | 'event' | 'rsvp';

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  /** ISO string used for ordering and for the date line. */
  timestamp: string;
  /** The third line: whatever this kind of thing has to say for itself. */
  meta: string;
  lat?: number;
  lng?: number;
  raw: any;
}

const KIND_META: Record<ActivityKind, { icon: string; label: string; color: string }> = {
  pin: { icon: 'location', label: 'Pin', color: '#28B873' },
  report: { icon: 'megaphone', label: 'Report', color: '#FF9500' },
  event: { icon: 'calendar', label: 'Event', color: '#5856D6' },
  rsvp: { icon: 'checkmark-circle', label: 'Going', color: '#007AFF' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pin', label: 'Pins' },
  { id: 'report', label: 'Reports' },
  { id: 'event', label: 'Events' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function coordsOf(row: any): { lat?: number; lng?: number } {
  const lat = row?.pin_lat ?? row?.lat ?? row?.location?.lat;
  const lng = row?.pin_lng ?? row?.lng ?? row?.location?.lng;
  return {
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
  };
}

/** "Aug 5 · 2:43 PM", or "Today · 2:43 PM" for the last day. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const year = d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : '';
  return `${day}${year} · ${time}`;
}

/** How much of a report's life is left — the one fact a report has that a pin doesn't. */
function expiryLabel(expiresAt?: string): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'Expired';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'Expires in under an hour';
  if (hours < 24) return `Expires in ${hours}h`;
  return `Expires in ${Math.round(hours / 24)}d`;
}

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useAlert();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      // Four independent lists; one failing should not blank the other three.
      const [pinsRes, reportsRes, eventsRes, rsvpsRes] = await Promise.allSettled([
        userAPI.getUserPins(user.id),
        userAPI.getUserReports(user.id),
        userAPI.getUserEvents(user.id),
        userAPI.getUserRSVPs(user.id),
      ]);

      const collected: ActivityItem[] = [];

      if (pinsRes.status === 'fulfilled') {
        for (const p of pinsRes.value?.data?.pins ?? []) {
          const verifications = p.verification_count ?? 0;
          collected.push({
            id: `pin-${p.id}`,
            kind: 'pin',
            title: p.title || 'Untitled pin',
            timestamp: p.created_at,
            meta:
              verifications > 0
                ? `${verifications} ${verifications === 1 ? 'verification' : 'verifications'}`
                : 'No verifications yet',
            ...coordsOf(p),
            raw: p,
          });
        }
      }

      if (reportsRes.status === 'fulfilled') {
        for (const r of reportsRes.value?.data?.reports ?? []) {
          collected.push({
            id: `report-${r.id}`,
            kind: 'report',
            title: r.content?.trim() || 'Report',
            timestamp: r.created_at,
            meta: expiryLabel(r.expires_at),
            ...coordsOf(r),
            raw: r,
          });
        }
      }

      if (eventsRes.status === 'fulfilled') {
        for (const e of eventsRes.value?.data?.events ?? []) {
          const going = e.attendee_count ?? e.going_count ?? 0;
          collected.push({
            id: `event-${e.id}`,
            kind: 'event',
            title: e.title || 'Untitled event',
            timestamp: e.start_time || e.created_at,
            meta: going > 0 ? `${going} going` : 'No RSVPs yet',
            ...coordsOf(e),
            raw: e,
          });
        }
      }

      const rsvpItems: ActivityItem[] = [];
      if (rsvpsRes.status === 'fulfilled') {
        for (const row of rsvpsRes.value?.data?.rsvps ?? []) {
          const e = row.event;
          if (!e) continue;
          rsvpItems.push({
            id: `rsvp-${e.id}`,
            kind: 'rsvp',
            title: e.title || 'Untitled event',
            timestamp: e.start_time || e.created_at,
            meta: row.status === 'going' ? "You're going" : 'Interested',
            ...coordsOf(e),
            raw: e,
          });
        }
      }

      const now = Date.now();
      // Anything still ahead of us belongs at the top under its own heading;
      // a list sorted purely newest-first would bury tomorrow's event beneath
      // a pin dropped an hour ago.
      const isAhead = (i: ActivityItem) => new Date(i.timestamp).getTime() > now;
      const ahead = [...collected.filter((i) => i.kind === 'event' && isAhead(i)), ...rsvpItems.filter(isAhead)];
      const past = collected.filter((i) => !(i.kind === 'event' && isAhead(i)));

      ahead.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      past.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setUpcoming(ahead);
      setItems(past);

      if ([pinsRes, reportsRes, eventsRes, rsvpsRes].every((r) => r.status === 'rejected')) {
        showToast('Could not load your activity', 'error');
      }
    } catch {
      showToast('Could not load your activity', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, showToast]);

  // Fires on mount and on every return to the tab, so coming back from
  // dropping a pin does not show a list without it.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  const hero = filtered[0];
  const rest = filtered.slice(1);

  /**
   * Targets the item by id rather than by coordinate. The map only acts on a
   * `targetLocation` once it has a fix on the user, so a coordinate hand-off
   * does nothing at all until location resolves; the id opens the item's sheet
   * either way. There is no EventDetail route — event and report detail are
   * sheets inside the map.
   */
  const openOnMap = (item: ActivityItem) => {
    const params =
      item.kind === 'pin'
        ? { targetPinId: item.raw.id }
        : item.kind === 'report'
          ? { targetReportId: item.raw.id }
          : { targetEventId: item.raw.id };
    navigation.navigate('Map', params);
  };

  /** Only pins have a second place to go. */
  const openReviews = (item: ActivityItem) =>
    navigation.navigate('ItemReviews', {
      itemType: 'pin',
      itemId: item.raw.id,
      itemTitle: item.title,
    });

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        content: {
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
        },

        title: {
          ...typography.h1,
          fontSize: 34,
          letterSpacing: -1,
          color: colors.text,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        },

        sectionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        sectionTitle: { ...typography.h4, fontSize: 20, letterSpacing: -0.4, color: colors.text },
        filterButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          alignItems: 'center',
          justifyContent: 'center',
        },
        filterButtonActive: { backgroundColor: colors.accentTint },

        filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
        filterChip: {
          paddingVertical: 7,
          paddingHorizontal: spacing.md - 2,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        filterChipActive: { backgroundColor: colors.accentTint, borderColor: colors.accent },
        filterChipText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        filterChipTextActive: { color: colors.accent },

        // ── Hero card ── the most recent thing, given room to be looked at.
        hero: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.sm + 2,
          marginBottom: spacing.lg,
        },
        heroBody: { paddingHorizontal: spacing.sm, paddingTop: spacing.md },
        heroTitle: { ...typography.h4, fontSize: 21, letterSpacing: -0.4, color: colors.text },
        heroWhen: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
        heroMeta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
        heroActions: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.md,
          paddingBottom: spacing.xs,
        },
        heroAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 9,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
        },
        heroActionText: { ...typography.bodySmallMedium, color: colors.text },

        // ── Compact rows ──
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          gap: spacing.sm + 4,
        },
        rowDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: 64,
        },
        tile: {
          width: 52,
          height: 52,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rowBody: { flex: 1, gap: 2 },
        rowTitle: { ...typography.bodyMedium, color: colors.text },
        rowWhen: { ...typography.bodySmall, color: colors.textSecondary },
        rowMeta: { ...typography.caption, color: colors.textMuted },
        rowAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 8,
          paddingHorizontal: spacing.sm + 4,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
        },
        rowActionText: { ...typography.bodySmallMedium, color: colors.text },

        upcomingCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 4,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },

        empty: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
        emptyIcon: {
          width: 76,
          height: 76,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyTitle: { ...typography.h5, color: colors.text, marginTop: spacing.lg },
        emptyText: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.sm,
          lineHeight: 21,
        },
        emptyButton: {
          marginTop: spacing.lg,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.round,
          backgroundColor: colors.interactiveBg,
        },
        emptyButtonText: { ...typography.bodySmallSemibold, color: colors.interactiveText },
      }),
    [colors, insets.bottom]
  );

  const renderRow = (item: ActivityItem, isLast: boolean) => {
    const meta = KIND_META[item.kind];
    return (
      <View key={item.id}>
        <TouchableOpacity
          style={s.row}
          onPress={() => openOnMap(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${meta.label}: ${item.title}. Opens on the map.`}
        >
          <View style={[s.tile, { backgroundColor: `${meta.color}22` }]}>
            <Ionicons name={meta.icon as any} size={22} color={meta.color} />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.rowWhen}>{whenLabel(item.timestamp)}</Text>
            {!!item.meta && <Text style={s.rowMeta}>{item.meta}</Text>}
          </View>
          {item.kind === 'pin' ? (
            <TouchableOpacity
              style={s.rowAction}
              onPress={() => openReviews(item)}
              accessibilityRole="button"
              accessibilityLabel={`Reviews for ${item.title}`}
            >
              <Ionicons name="star-outline" size={14} color={colors.text} />
              <Text style={s.rowActionText}>Reviews</Text>
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        {!isLast && <View style={s.rowDivider} />}
      </View>
    );
  };

  const header = (
    <>
      <Text style={s.title}>Activity</Text>

      {upcoming.length > 0 && (
        <>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Upcoming</Text>
          </View>
          {upcoming.slice(0, 3).map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <TouchableOpacity
                key={item.id}
                style={s.upcomingCard}
                onPress={() => openOnMap(item)}
                activeOpacity={0.8}
              >
                <View style={[s.tile, { backgroundColor: `${meta.color}22` }]}>
                  <Ionicons name={meta.icon as any} size={22} color={meta.color} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={s.rowWhen}>{whenLabel(item.timestamp)}</Text>
                  {!!item.meta && <Text style={s.rowMeta}>{item.meta}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <View style={[s.sectionRow, upcoming.length > 0 && { marginTop: spacing.lg }]}>
        <Text style={s.sectionTitle}>Past</Text>
        <TouchableOpacity
          style={[s.filterButton, filter !== 'all' && s.filterButtonActive]}
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Filter activity"
          accessibilityState={{ expanded: showFilters }}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={filter === 'all' ? colors.text : colors.accent}
          />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={s.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[s.filterChip, filter === f.id && s.filterChipActive]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.id }}
            >
              <Text style={[s.filterChipText, filter === f.id && s.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View>
          {[0, 1, 2, 3].map((i) => (
            <AvatarRowSkeleton key={i} avatarSize={52} lines={3} />
          ))}
        </View>
      )}

      {/* The newest item, with the map it happened on. Everything below it is
          a row; this one is the reason you opened the tab. */}
      {!loading && hero && (
        <View style={s.hero}>
          {hero.lat != null && hero.lng != null && (
            <LocationThumbnail lat={hero.lat} lng={hero.lng} height={158} showLabel={false} />
          )}
          <View style={s.heroBody}>
            <Text style={s.heroTitle} numberOfLines={2}>
              {hero.title}
            </Text>
            <Text style={s.heroWhen}>{whenLabel(hero.timestamp)}</Text>
            <Text style={s.heroMeta}>
              {KIND_META[hero.kind].label}
              {hero.meta ? ` · ${hero.meta}` : ''}
            </Text>
            <View style={s.heroActions}>
              <TouchableOpacity
                style={s.heroAction}
                onPress={() => openOnMap(hero)}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={15} color={colors.text} />
                <Text style={s.heroActionText}>Show on map</Text>
              </TouchableOpacity>
              {hero.kind === 'pin' && (
                <TouchableOpacity
                  style={s.heroAction}
                  onPress={() => openReviews(hero)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star-outline" size={15} color={colors.text} />
                  <Text style={s.heroActionText}>Reviews</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <FlatList
        data={loading ? [] : rest}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => renderRow(item, index === rest.length - 1)}
        ListHeaderComponent={header}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.text}
          />
        }
        ListEmptyComponent={
          !loading && !hero ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name={filter === 'all' ? 'compass-outline' : 'funnel-outline'}
                  size={32}
                  color={colors.textMuted}
                />
              </View>
              <Text style={s.emptyTitle}>
                {filter === 'all' ? 'Nothing here yet' : `No ${filter}s yet`}
              </Text>
              <Text style={s.emptyText}>
                {filter === 'all'
                  ? 'Pins you drop, reports you file and events you create all show up here.'
                  : 'Try a different filter, or add one from the map.'}
              </Text>
              <TouchableOpacity
                style={s.emptyButton}
                onPress={() =>
                  filter === 'all' ? navigation.navigate('Map') : setFilter('all')
                }
                activeOpacity={0.85}
              >
                <Text style={s.emptyButtonText}>
                  {filter === 'all' ? 'Open the map' : 'Show everything'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}
