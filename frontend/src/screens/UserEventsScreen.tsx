import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CardSkeleton, SkeletonList } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { userAPI, eventAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const EVENT_CATEGORIES: { [key: string]: { icon: string; color: string } } = {
  social: { icon: 'people', color: '#276EF1' },
  academic: { icon: 'school', color: '#05A357' },
  sports: { icon: 'fitness', color: '#E5A200' },
  club: { icon: 'flag', color: '#9747FF' },
  party: { icon: 'beer', color: '#E11900' },
  other: { icon: 'calendar', color: '#757575' },
};

interface UserEventsScreenProps {
  navigation: any;
}

export default function UserEventsScreen({ navigation }: UserEventsScreenProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [activeTab, setActiveTab] = useState<'created' | 'going'>('created');
  const [createdEvents, setCreatedEvents] = useState<any[]>([]);
  const [rsvpEvents, setRsvpEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingEventIds, setCancellingEventIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        headerBtn: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: { ...typography.h3, color: colors.text },
        headerSpacer: { width: 40 },

        tabRow: {
          flexDirection: 'row',
          marginHorizontal: spacing.md,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          padding: 3,
          marginBottom: spacing.sm,
        },
        tab: {
          flex: 1,
          paddingVertical: spacing.sm + 2,
          alignItems: 'center',
          borderRadius: borderRadius.sm - 2,
        },
        tabActive: {
          backgroundColor: colors.surfaceHigh,
        },
        tabText: { ...typography.bodySmallSemibold, color: colors.textMuted },
        tabTextActive: { color: colors.text },

        listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xl },

        card: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        iconWrap: {
          width: 42,
          height: 42,
          borderRadius: 21,
          justifyContent: 'center',
          alignItems: 'center',
        },
        cardInfo: { flex: 1 },
        cardTitle: { ...typography.bodySmallSemibold, color: colors.text },
        cardCategory: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
        actionBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255, 69, 58, 0.16)',
          justifyContent: 'center',
          alignItems: 'center',
        },

        detailsArea: { marginTop: spacing.sm, gap: 4 },
        detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        detailText: { ...typography.caption, color: colors.textSecondary },

        cardFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        statText: { ...typography.caption, color: colors.textMuted },
        pastBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          backgroundColor: colors.surfaceHigh,
          borderRadius: borderRadius.round,
        },
        pastText: { ...typography.caption, color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
        cancelledBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          backgroundColor: 'rgba(255, 69, 58, 0.18)',
          borderRadius: borderRadius.round,
        },
        cancelledText: { ...typography.caption, color: colors.error, fontSize: 10, fontWeight: '700' },

        emptyState: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxl * 2,
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        emptyTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
        emptySub: {
          ...typography.bodySmall,
          color: colors.textMuted,
          textAlign: 'center',
          paddingHorizontal: spacing.xl,
        },
      }),
    [colors]
  );

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    if (!user) return;
    try {
      const [createdResponse, rsvpsResponse] = await Promise.all([
        userAPI.getUserEvents(user.id),
        userAPI.getUserRSVPs(user.id),
      ]);
      setCreatedEvents(createdResponse.data?.events || []);
      setRsvpEvents(rsvpsResponse.data?.rsvps?.map((r: any) => r.event).filter(Boolean) || []);
    } catch (error) {
      console.error('Error loading events:', error);
      showToast('Failed to load your events', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleCancelEvent = (eventId: string) => {
    showAlert('Cancel Event', 'Are you sure you want to cancel this event?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          if (cancellingEventIds.includes(eventId)) return;
          setCancellingEventIds((prev) => [...prev, eventId]);
          try {
            await eventAPI.cancelEvent(eventId);
            setCreatedEvents((prev) =>
              prev.map((ev) => (ev.id === eventId ? { ...ev, status: 'cancelled' } : ev))
            );
            showToast('Event cancelled. It will no longer show on the map.', 'success');
          } catch (error) {
            showToast('Failed to cancel event', 'error');
          } finally {
            setCancellingEventIds((prev) => prev.filter((id) => id !== eventId));
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderEvent = ({ item }: { item: any }) => {
    const cat = EVENT_CATEGORIES[item.category] || EVENT_CATEGORIES.other;
    const isPast = new Date(item.end_time) < new Date();
    const isCancelled = item.status === 'cancelled';
    const isCancelling = cancellingEventIds.includes(item.id);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() =>
          navigation.navigate('Main', {
            screen: 'Map',
            params: { targetEventId: item.id },
          })
        }
        disabled={isCancelled}
        activeOpacity={0.7}
      >
        <View style={s.cardRow}>
          <View style={[s.iconWrap, { backgroundColor: cat.color + '18' }]}>
            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardCategory}>{item.category}</Text>
          </View>
          {activeTab === 'created' && !isCancelled && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.surfaceHigh }]}
                onPress={() => showToast('Event editing coming soon', 'info')}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, isCancelling && { opacity: 0.6 }]}
                onPress={() => handleCancelEvent(item.id)}
                activeOpacity={0.7}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="ban-outline" size={16} color={colors.error} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.detailsArea}>
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={s.detailText}>{formatDate(item.start_time)}</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={s.detailText}>{formatTime(item.start_time)} – {formatTime(item.end_time)}</Text>
          </View>
          {item.location_name && (
            <View style={s.detailRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={s.detailText}>{item.location_name}</Text>
            </View>
          )}
        </View>

        <View style={s.cardFooter}>
          <View style={s.statRow}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={s.statText}>
              {item.current_attendees || 0}{item.max_attendees ? `/${item.max_attendees}` : ''} going
            </Text>
          </View>
          {isCancelled ? (
            <View style={s.cancelledBadge}>
              <Text style={s.cancelledText}>CANCELLED</Text>
            </View>
          ) : isPast ? (
            <View style={s.pastBadge}>
              <Text style={s.pastText}>ENDED</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const currentEvents = activeTab === 'created' ? createdEvents : rsvpEvents;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Events</Text>
        <View style={s.headerSpacer} />
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'created' && s.tabActive]}
          onPress={() => setActiveTab('created')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'created' && s.tabTextActive]}>Created</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'going' && s.tabActive]}
          onPress={() => setActiveTab('going')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'going' && s.tabTextActive]}>Going</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.container}>
          <SkeletonList count={4} style={{ paddingTop: spacing.md }}>
            {() => <CardSkeleton lines={3} hasFooter style={{ marginHorizontal: spacing.md }} />}
          </SkeletonList>
        </View>
      ) : (
        <FlatList
          data={currentEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>
                {activeTab === 'created' ? 'No events created' : 'No RSVPs yet'}
              </Text>
              <Text style={s.emptySub}>
                {activeTab === 'created'
                  ? 'Create an event to bring your community together!'
                  : 'RSVP to events to see them here!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
