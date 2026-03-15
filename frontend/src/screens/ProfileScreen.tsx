import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useGroup } from '../context/GroupContext';
import { userAPI } from '../services/api';

// ─── Level system ─────────────────────────────────────────────────────────────
function getLevel(totalContribs: number) {
  const thresholds = [0, 5, 15, 30, 60, 100, 175, 275, 400, 600, 1000];
  const titles = [
    'New Scout', 'Explorer', 'Local Guide', 'Connector', 'Neighborhood Pro',
    'Community Builder', 'District Legend', 'City Expert', 'Urban Master', 'Map Sage', 'Community Icon',
  ];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (totalContribs >= thresholds[i]) level = i;
  }
  const current = thresholds[level];
  const next = thresholds[Math.min(level + 1, thresholds.length - 1)];
  const pct = next === current ? 1 : Math.min(1, (totalContribs - current) / (next - current));
  return { level: level + 1, title: titles[level], pct, next, current: totalContribs };
}

// ─── Badge definitions ────────────────────────────────────────────────────────
const BADGES = [
  { id: 'first_pin',  icon: 'location',        label: 'First Pin',       color: '#28B873', condition: (u: any) => u.pins >= 1 },
  { id: 'five_pins',  icon: 'map',              label: 'Pin Hoarder',     color: '#3B82F6', condition: (u: any) => u.pins >= 5 },
  { id: 'ten_pins',   icon: 'trophy',           label: 'Pin Master',      color: '#F59E0B', condition: (u: any) => u.pins >= 10 },
  { id: 'first_evt',  icon: 'calendar',         label: 'Event Creator',   color: '#8B5CF6', condition: (u: any) => u.events >= 1 },
  { id: 'five_evts',  icon: 'star',             label: 'Event Organizer', color: '#EC4899', condition: (u: any) => u.events >= 5 },
  { id: 'reputation', icon: 'shield-checkmark', label: 'Trusted Member',  color: '#10B981', condition: (u: any) => u.reputation >= 50 },
  { id: 'explorer',   icon: 'compass',          label: 'Explorer',        color: '#F97316', condition: (u: any) => u.pins >= 3 && u.events >= 1 },
  { id: 'og',         icon: 'flame',            label: 'OG Member',       color: '#EF4444', condition: (u: any) => u.pins >= 1 },
];

function heatColor(val: number, colors: any) {
  if (val === 0) return colors.surfaceHigh;
  const a = [0.35, 0.5, 0.65, 0.85, 1][Math.min(val, 4)];
  return `rgba(40, 184, 115, ${a})`;
}

interface ProfileScreenProps {
  navigation: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { groups, activeGroup } = useGroup();
  const insets = useSafeAreaInsets();

  const pinsCreated   = (user as any)?.pinsCreated    ?? 0;
  const eventsCreated = (user as any)?.eventsCreated  ?? 0;
  const reputation    = (user as any)?.reputationScore ?? 0;
  const streak        = (user as any)?.streak         ?? 0;
  const avatarUrl     = (user as any)?.avatarUrl;
  const bio           = (user as any)?.bio;
  const username      = (user as any)?.username;

  const totalContribs = pinsCreated + eventsCreated;
  const levelInfo = getLevel(totalContribs);
  const progressLabel = `${levelInfo.current}`;
  const progressPct = levelInfo.pct;

  // Next level nudge
  const LEVEL_THRESHOLDS = [0, 5, 15, 30, 60, 100, 175, 275, 400, 600, 1000];
  const nextThreshold = LEVEL_THRESHOLDS[Math.min(levelInfo.level, LEVEL_THRESHOLDS.length - 1)];
  const toNextLevel = Math.max(0, nextThreshold - totalContribs);

  const [activityData, setActivityData] = useState<{ date: string; count: number }[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    userAPI.getUserActivity(user.id, 91)
      .then(res => {
        if (res?.data?.activity) setActivityData(res.data.activity);
        else if (Array.isArray(res?.activity)) setActivityData(res.activity);
      })
      .catch(() => {});
    userAPI.getLeaderboard()
      .then(res => {
        const data = res?.data?.leaders ?? res?.leaders ?? [];
        setLeaderboard(data);
      })
      .catch(() => {});
  }, [user?.id]);

  const heatmapCells = useMemo(() => {
    const arr = Array(91).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activityData.forEach((d) => {
      const date = new Date(d.date);
      date.setHours(0, 0, 0, 0);
      const offset = Math.round((today.getTime() - date.getTime()) / (24 * 3600 * 1000));
      const idx = 90 - offset;
      if (idx >= 0 && idx < 91) arr[idx] = Math.min(d.count, 4);
    });
    return arr;
  }, [activityData]);

  const heatmapCols: number[][] = [];
  for (let col = 0; col < 13; col++) {
    heatmapCols.push(heatmapCells.slice(col * 7, col * 7 + 7));
  }

  const badgeCtx = { pins: pinsCreated, events: eventsCreated, reputation };
  const earnedBadges = BADGES.filter(b => b.condition(badgeCtx));

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scrollView: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.round,
      backgroundColor: colors.surfaceGray,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerName: {
      flex: 1,
      ...typography.h1,
      color: colors.text,
      lineHeight: 34,
      letterSpacing: -0.8,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
      textTransform: 'lowercase',
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarWrap: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surfaceGray,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 54, height: 54, borderRadius: 27 },
    avatarInitial: { fontSize: 24, fontWeight: '700', color: colors.text },
    editAvatarBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    repBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginHorizontal: spacing.md,
      backgroundColor: colors.surfaceGray,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: spacing.xs,
      gap: 6,
    },
    repText: { ...typography.captionMedium, color: colors.text },
    badgesRow2: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${colors.warning}1F`,
      borderWidth: 1,
      borderColor: `${colors.warning}40`,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    streakText: { ...typography.captionMedium, color: colors.warning },
    nudgeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.accentTint30,
      borderWidth: 1,
      borderColor: colors.accentTint,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    nudgeText: { ...typography.captionMedium, color: colors.accent },
    leaderboardSection: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.surfaceGray,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    leaderboardTitle: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    leaderboardRank: {
      width: 24,
      textAlign: 'center',
      ...typography.captionMedium,
      color: colors.textMuted,
    },
    leaderboardRankTop: { color: colors.warning, fontWeight: '700' },
    leaderboardAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    leaderboardAvatarImg: { width: 28, height: 28, borderRadius: 14 },
    leaderboardAvatarText: { fontSize: 12, fontWeight: '700', color: colors.text },
    leaderboardName: { flex: 1, ...typography.bodySmallSemibold, color: colors.text },
    leaderboardScore: { ...typography.captionMedium, color: colors.textSecondary },
    leaderboardYou: { color: colors.accent, fontWeight: '700' },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    tile: {
      width: '48.5%',
      backgroundColor: colors.surfaceGray,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      minHeight: 98,
      justifyContent: 'space-between',
    },
    tileFullWidth: {
      width: '100%',
    },
    tileWide: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 108,
      backgroundColor: colors.surfaceGray,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    tileTitle: { ...typography.bodySemibold, color: colors.text },
    tileSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
    ring: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 4,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    ringFill: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.accentTint30,
    },
    ringText: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' },
    ringLevelNum: { color: colors.accent, fontWeight: '800', fontSize: 18 },

    // Heatmap
    heatmapSection: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.surfaceGray,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    heatmapTitle: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm },
    heatmapGrid: { flexDirection: 'row', gap: 3 },
    heatmapCol: { flexDirection: 'column', gap: 3 },
    heatmapCell: { width: 10, height: 10, borderRadius: 2 },

    // Badges
    badgesSection: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    badgesTitle: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: borderRadius.round,
      backgroundColor: colors.surfaceGray,
    },
    badgeText: { ...typography.captionMedium, color: colors.text },
    list: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    rowLabel: { ...typography.bodySemibold, color: colors.text },
    rowSub: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
    rowIconWrap: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rightArrow: { marginLeft: 'auto' },
    footerStats: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    footerCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footerTitle: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
    footerValue: { ...typography.bodySemibold, color: colors.text },
    logoutBtn: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: 0,
      height: 52,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceGray,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoutText: { ...typography.button, color: colors.error },
  }), [colors]);

  const handleLogout = () => {
    showAlert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { try { await logout(); } catch {} } },
    ]);
  };

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
      >
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            style={s.headerBackBtn}
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate('Main', { screen: 'Map' })
            }
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {(user.name || 'Profile').toLowerCase()}
          </Text>
          <TouchableOpacity
            style={[s.avatarContainer, { alignItems: 'center' }]}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <View style={s.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarInitial}>{user.name?.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={s.editAvatarBadge}>
              <Ionicons name="pencil" size={10} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.badgesRow2}>
          <View style={s.repBadge}>
            <Ionicons name="star" size={12} color={colors.text} />
            <Text style={s.repText}>{reputation} reputation</Text>
          </View>
          {streak > 0 && (
            <View style={s.streakBadge}>
              <Ionicons name="flame" size={12} color={colors.warning} />
              <Text style={s.streakText}>{streak}-day streak</Text>
            </View>
          )}
          {toNextLevel > 0 && levelInfo.level < 11 && (
            <View style={s.nudgeBadge}>
              <Ionicons name="arrow-up-circle-outline" size={12} color={colors.accent} />
              <Text style={s.nudgeText}>{toNextLevel} more to {['', 'Explorer', 'Local Guide', 'Connector', 'Neighborhood Pro', 'Community Builder', 'District Legend', 'City Expert', 'Urban Master', 'Map Sage', 'Community Icon'][levelInfo.level] || 'next level'}</Text>
            </View>
          )}
        </View>

        <View style={s.grid}>
          <TouchableOpacity style={s.tile} activeOpacity={0.75} onPress={() => navigation.navigate('UserPins')}>
            <Ionicons name="location-outline" size={20} color={colors.text} />
            <View>
              <Text style={s.tileTitle}>My Pins</Text>
              <Text style={s.tileSub}>{pinsCreated} created</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.tile} activeOpacity={0.75} onPress={() => navigation.navigate('UserEvents')}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
            <View>
              <Text style={s.tileTitle}>My Events</Text>
              <Text style={s.tileSub}>{eventsCreated} created</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.tile} activeOpacity={0.75} onPress={() => navigation.navigate('SavedItems')}>
            <Ionicons name="bookmark-outline" size={20} color={colors.text} />
            <View>
              <Text style={s.tileTitle}>Saved</Text>
              <Text style={s.tileSub}>Your saved places</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.tile} activeOpacity={0.75} onPress={() => navigation.navigate('UserReports')}>
            <Ionicons name="flag-outline" size={20} color={colors.text} />
            <View>
              <Text style={s.tileTitle}>My Reports</Text>
              <Text style={s.tileSub}>Reports you filed</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.tile, s.tileWide, { gap: spacing.sm }]} activeOpacity={0.75} onPress={() => navigation.navigate('Groups')}>
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={s.tileTitle}>Groups</Text>
              <Text style={s.tileSub}>
                {activeGroup ? `Active: ${activeGroup.name}` : groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? 's' : ''}` : 'Create or join a group'}
              </Text>
            </View>
            {activeGroup && (
              <View style={{ backgroundColor: colors.accentTint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ ...typography.label, color: colors.accent, fontSize: 10 }}>ACTIVE</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.mediumGray} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.tile, s.tileFullWidth]} activeOpacity={0.75} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <View>
              <Text style={s.tileTitle}>Settings</Text>
              <Text style={s.tileSub}>App preferences</Text>
            </View>
          </TouchableOpacity>

          <View style={s.tileWide}>
            <View>
              <Text style={s.tileTitle}>Community level</Text>
              <Text style={s.tileSub}>Level {levelInfo.level} • {levelInfo.title}</Text>
            </View>
            <View style={s.ring}>
              <View style={[s.ringFill, { height: `${Math.round(progressPct * 100)}%` as any }]} />
              <Text style={s.ringLevelNum}>{levelInfo.level}</Text>
              <Text style={s.ringText}>{Math.round(progressPct * 100)}%</Text>
            </View>
          </View>
        </View>

        {/* Activity Heatmap */}
        {heatmapCols.length > 0 && (
          <View style={s.heatmapSection}>
            <Text style={s.heatmapTitle}>Activity (last 13 weeks)</Text>
            <View style={s.heatmapGrid}>
              {heatmapCols.map((col, ci) => (
                <View key={ci} style={s.heatmapCol}>
                  {col.map((val, ri) => (
                    <View key={ri} style={[s.heatmapCell, { backgroundColor: heatColor(val, colors) }]} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Badges */}
        <View style={s.badgesSection}>
          <Text style={s.badgesTitle}>Badges{earnedBadges.length > 0 ? ` (${earnedBadges.length})` : ''}</Text>
          {earnedBadges.length > 0 ? (
            <View style={s.badgesRow}>
              {earnedBadges.map((b) => (
                <View key={b.id} style={s.badge}>
                  <Ionicons name={b.icon as any} size={14} color={b.color} />
                  <Text style={s.badgeText}>{b.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ ...typography.bodySmall, color: colors.textMuted }}>
              Earn your first badge — add a pin or attend an event!
            </Text>
          )}
        </View>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={s.leaderboardSection}>
            <Text style={s.leaderboardTitle}>Top contributors</Text>
            {leaderboard.slice(0, 5).map((leader: any, idx: number) => {
              const isYou = leader.id === user?.id;
              const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
              return (
                <View key={leader.id} style={[s.leaderboardRow, idx === leaderboard.slice(0, 5).length - 1 && { borderBottomWidth: 0 }]}>
                  {rankEmoji
                    ? <Text style={[s.leaderboardRank, s.leaderboardRankTop]}>{rankEmoji}</Text>
                    : <Text style={s.leaderboardRank}>{leader.rank}</Text>
                  }
                  <View style={s.leaderboardAvatar}>
                    {leader.avatarUrl
                      ? <Image source={{ uri: leader.avatarUrl }} style={s.leaderboardAvatarImg} />
                      : <Text style={s.leaderboardAvatarText}>{(leader.name || '?').charAt(0).toUpperCase()}</Text>
                    }
                  </View>
                  <Text style={[s.leaderboardName, isYou && s.leaderboardYou]} numberOfLines={1}>
                    {isYou ? 'You' : (leader.username ? `@${leader.username}` : leader.name)}
                  </Text>
                  <Text style={s.leaderboardScore}>{leader.reputationScore} pts</Text>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
