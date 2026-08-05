import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing } from '../constants/theme';

// ─── Base shimmer block ───────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width, height = 12, radius = borderRadius.sm, style }: SkeletonBoxProps) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.border, opacity: anim },
        style,
      ]}
    />
  );
}

// ─── Card skeleton (icon + two text lines + optional footer) ─────────────────

interface CardSkeletonProps {
  lines?: 1 | 2 | 3;
  hasFooter?: boolean;
  style?: ViewStyle;
}

export function CardSkeleton({ lines = 2, hasFooter = false, style }: CardSkeletonProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceGray, borderColor: colors.border }, style]}>
      <View style={styles.cardRow}>
        <SkeletonBox width={42} height={42} radius={21} />
        <View style={styles.cardLines}>
          <SkeletonBox width="55%" height={13} />
          {lines >= 2 && <SkeletonBox width="38%" height={11} style={{ marginTop: 5 }} />}
          {lines >= 3 && <SkeletonBox width="70%" height={11} style={{ marginTop: 5 }} />}
        </View>
      </View>
      {hasFooter && (
        <View style={styles.cardFooter}>
          <SkeletonBox width="30%" height={10} />
          <SkeletonBox width="20%" height={10} />
        </View>
      )}
    </View>
  );
}

// ─── Row skeleton (smaller, no card bg — for modals/sheets) ──────────────────

export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBox width={34} height={34} radius={10} />
      <View style={styles.rowLines}>
        <SkeletonBox width="45%" height={13} />
        <SkeletonBox width="28%" height={11} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

// ─── Avatar + text row (for chat / reviews / feed) ───────────────────────────

interface AvatarRowSkeletonProps {
  avatarSize?: number;
  lines?: 1 | 2 | 3;
}

export function AvatarRowSkeleton({ avatarSize = 40, lines = 2 }: AvatarRowSkeletonProps) {
  return (
    <View style={styles.avatarRow}>
      <SkeletonBox width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
      <View style={styles.rowLines}>
        <SkeletonBox width="50%" height={13} />
        {lines >= 2 && <SkeletonBox width="35%" height={11} style={{ marginTop: 5 }} />}
        {lines >= 3 && <SkeletonBox width="75%" height={11} style={{ marginTop: 5 }} />}
      </View>
    </View>
  );
}

// ─── Chat skeleton (alternating left/right bubbles) ──────────────────────────

export function ChatSkeleton() {
  return (
    <View style={styles.chatWrap}>
      {[
        { own: false, w: '55%' },
        { own: true,  w: '45%' },
        { own: false, w: '65%' },
        { own: false, w: '40%' },
        { own: true,  w: '50%' },
      ].map((item, i) => (
        <View key={i} style={[styles.chatRow, item.own && styles.chatRowOwn]}>
          {!item.own && <SkeletonBox width={28} height={28} radius={14} style={{ marginRight: 8, flexShrink: 0 }} />}
          <SkeletonBox width={item.w as `${number}%`} height={36} radius={16} />
        </View>
      ))}
    </View>
  );
}

// ─── Profile skeleton ─────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.profileWrap, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.profileHeader}>
        <SkeletonBox width={54} height={54} radius={27} />
        <View style={styles.profileHeaderLines}>
          <SkeletonBox width={140} height={16} />
          <SkeletonBox width={90} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      {/* Stat tiles */}
      <View style={styles.profileTiles}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.profileTile, { backgroundColor: colors.surfaceGray, borderColor: colors.border }]}>
            <SkeletonBox width={32} height={18} radius={6} />
            <SkeletonBox width={48} height={11} radius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      {/* List rows */}
      {[0, 1, 2, 3].map((i) => (
        <CardSkeleton key={i} lines={2} style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }} />
      ))}
    </View>
  );
}

// ─── EventDetail skeleton ─────────────────────────────────────────────────────

export function EventDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      <SkeletonBox width="70%" height={18} />
      <SkeletonBox width={200} height={180} radius={borderRadius.md} style={{ alignSelf: 'center' }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.avatarRow}>
          <SkeletonBox width={36} height={36} radius={18} />
          <View style={styles.rowLines}>
            <SkeletonBox width="55%" height={13} />
            <SkeletonBox width="35%" height={11} style={{ marginTop: 5 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── FeedPost skeleton ────────────────────────────────────────────────────────

export function FeedPostSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.feedPost, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.avatarRow}>
        <SkeletonBox width={40} height={40} radius={20} />
        <View style={styles.rowLines}>
          <SkeletonBox width="40%" height={13} />
          <SkeletonBox width="25%" height={11} style={{ marginTop: 5 }} />
        </View>
      </View>
      <SkeletonBox width="90%" height={13} style={{ marginTop: spacing.sm }} />
      <SkeletonBox width="75%" height={13} style={{ marginTop: 5 }} />
      <SkeletonBox width="100%" height={160} radius={borderRadius.md} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

// ─── PinDetail skeleton (body of the pin detail sheet) ───────────────────────

export function PinDetailSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md }}>
      {/* About section */}
      <View style={{ gap: 6 }}>
        <SkeletonBox width="25%" height={11} />
        <SkeletonBox width="90%" height={13} style={{ marginTop: 4 }} />
        <SkeletonBox width="75%" height={13} />
      </View>

      {/* Creator row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
        <SkeletonBox width={36} height={36} radius={18} />
        <View style={{ flex: 1, gap: 5 }}>
          <SkeletonBox width="40%" height={13} />
          <SkeletonBox width="28%" height={11} />
        </View>
      </View>

      {/* Photos section */}
      <View style={{ gap: 6 }}>
        <SkeletonBox width="20%" height={11} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} width={80} height={80} radius={8} />
          ))}
        </View>
      </View>

      {/* Reviews section */}
      <View style={{ gap: 6 }}>
        <SkeletonBox width="22%" height={11} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <SkeletonBox width={32} height={32} radius={6} />
          <View style={{ flex: 1, gap: 5 }}>
            <SkeletonBox width="35%" height={11} />
            <SkeletonBox width="22%" height={10} />
          </View>
        </View>
      </View>

      {/* Reports section */}
      <View style={{ gap: 6 }}>
        <SkeletonBox width="20%" height={11} />
        <SkeletonBox width="55%" height={11} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLines: {
    flex: 1,
    gap: 0,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 59,
    gap: spacing.sm,
  },
  rowLines: {
    flex: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chatWrap: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  chatRowOwn: {
    justifyContent: 'flex-end',
  },
  profileWrap: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  profileHeaderLines: {
    flex: 1,
  },
  profileTiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  profileTile: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  feedPost: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
