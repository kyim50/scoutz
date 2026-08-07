import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  interpolate,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing } from '../constants/theme';

// ─── The shared driver ────────────────────────────────────────────────────────

/**
 * One animation for every skeleton on screen.
 *
 * Each box used to own an Animated.Value and start its own loop in its own
 * effect, so a screen showing four cards ran twenty loops, each phased to
 * whenever that particular box happened to mount. Nothing was ever in step —
 * the result read as random flicker rather than one surface breathing, which
 * is most of why the loading states looked broken.
 *
 * A single module-level value fixes that by construction: every box reads the
 * same clock, so they cannot drift apart.
 */
const pulse = makeMutable(0);

/** Mounted boxes. The loop runs while this is above zero and not a moment longer. */
let activeCount = 0;

function retainPulse() {
  activeCount += 1;
  if (activeCount === 1) {
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }
}

function releasePulse() {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) {
    cancelAnimation(pulse);
    pulse.value = 0;
  }
}

function useSharedPulse() {
  useEffect(() => {
    retainPulse();
    return releasePulse;
  }, []);
}

/** The placeholder fill, which has to be visible against the surface it sits on. */
function useSkeletonColors() {
  const { colors, isDarkMode } = useTheme();
  return useMemo(
    () => ({
      // `border` was eight values off the dark surface and then faded to 0.4,
      // so at the bottom of every pulse the placeholder disappeared entirely.
      base: isDarkMode ? colors.surfaceHigh : colors.backgroundGray,
      highlight: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)',
    }),
    [colors, isDarkMode]
  );
}

// ─── Base block ───────────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  /** Off for very small blocks, where a travelling highlight is just noise. */
  shimmer?: boolean;
}

export function SkeletonBox({
  width,
  height = 12,
  radius = borderRadius.sm,
  style,
  shimmer = true,
}: SkeletonBoxProps) {
  const { base, highlight } = useSkeletonColors();
  useSharedPulse();

  // Measured, so the highlight crosses the block exactly once whatever its
  // size. A fixed distance overshoots a 42pt avatar and never finishes a
  // full-width bar.
  const boxWidth = useSharedValue(0);
  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      boxWidth.value = e.nativeEvent.layout.width;
    },
    [boxWidth]
  );

  const fadeStyle = useAnimatedStyle(() => ({
    // A narrow range: the block should breathe, not blink.
    opacity: 0.65 + pulse.value * 0.35,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pulse.value, [0, 1], [-boxWidth.value, boxWidth.value]) },
    ],
  }));

  return (
    <Reanimated.View
      onLayout={onLayout}
      style={[
        { width, height, borderRadius: radius, backgroundColor: base, overflow: 'hidden' },
        fadeStyle,
        style,
      ]}
    >
      {shimmer && height >= 16 && (
        <Reanimated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

// ─── Repeater ─────────────────────────────────────────────────────────────────

interface SkeletonListProps {
  /** How many placeholders to show. */
  count?: number;
  /** Anything above about eight is scrolled past before the data lands. */
  children: (index: number) => React.ReactNode;
  style?: ViewStyle;
}

/**
 * Renders a run of skeletons.
 *
 * Every screen was writing `[0,1,2,3].map(...)` with its own margin arithmetic
 * on the first item, which is how they ended up spaced differently from each
 * other and from the lists they stand in for.
 */
export function SkeletonList({ count = 4, children, style }: SkeletonListProps) {
  return (
    <View style={style}>
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>{children(i)}</React.Fragment>
      ))}
    </View>
  );
}

// ─── Card (icon + text lines + optional footer) ───────────────────────────────

interface CardSkeletonProps {
  lines?: 1 | 2 | 3;
  hasFooter?: boolean;
  style?: ViewStyle;
}

export function CardSkeleton({ lines = 2, hasFooter = false, style }: CardSkeletonProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceGray, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.cardRow}>
        <SkeletonBox width={42} height={42} radius={21} />
        <View style={styles.cardLines}>
          <SkeletonBox width="55%" height={13} />
          {lines >= 2 && <SkeletonBox width="38%" height={11} style={{ marginTop: 6 }} />}
          {lines >= 3 && <SkeletonBox width="70%" height={11} style={{ marginTop: 6 }} />}
        </View>
      </View>
      {hasFooter && (
        // The divider was hardcoded #ccc, a light grey line straight across
        // every skeleton card in the dark theme.
        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <SkeletonBox width="30%" height={10} />
          <SkeletonBox width="20%" height={10} />
        </View>
      )}
    </View>
  );
}

// ─── Row (no card fill — for modals and sheets) ───────────────────────────────

export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBox width={34} height={34} radius={10} />
      <View style={styles.rowLines}>
        <SkeletonBox width="45%" height={13} />
        <SkeletonBox width="28%" height={11} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// ─── Avatar + text row (chat, reviews, feed) ──────────────────────────────────

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
        {lines >= 2 && <SkeletonBox width="35%" height={11} style={{ marginTop: 6 }} />}
        {lines >= 3 && <SkeletonBox width="75%" height={11} style={{ marginTop: 6 }} />}
      </View>
    </View>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export function ChatSkeleton() {
  return (
    <View style={styles.chatWrap}>
      {[
        { own: false, w: '55%' },
        { own: true, w: '45%' },
        { own: false, w: '65%' },
        { own: false, w: '40%' },
        { own: true, w: '50%' },
      ].map((item, i) => (
        <View key={i} style={[styles.chatRow, item.own && styles.chatRowOwn]}>
          {!item.own && (
            <SkeletonBox width={28} height={28} radius={14} style={{ marginRight: 8, flexShrink: 0 }} />
          )}
          <SkeletonBox width={item.w as `${number}%`} height={36} radius={16} />
        </View>
      ))}
    </View>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    // `background` is a step darker than `surface`, which is what the profile
    // screen actually uses — so the skeleton used to sit on the wrong colour.
    <View style={[styles.profileWrap, { backgroundColor: colors.surface }]}>
      <View style={styles.profileHeader}>
        <SkeletonBox width={54} height={54} radius={27} />
        <View style={styles.profileHeaderLines}>
          <SkeletonBox width={140} height={16} />
          <SkeletonBox width={90} height={12} style={{ marginTop: 7 }} />
        </View>
      </View>
      <View style={styles.profileTiles}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.profileTile,
              { backgroundColor: colors.surfaceGray, borderColor: colors.border },
            ]}
          >
            <SkeletonBox width={32} height={18} radius={6} />
            <SkeletonBox width={48} height={11} radius={4} style={{ marginTop: 7 }} />
          </View>
        ))}
      </View>
      <SkeletonList count={4}>
        {(i) => (
          <CardSkeleton lines={2} style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }} />
        )}
      </SkeletonList>
    </View>
  );
}

// ─── Event detail ─────────────────────────────────────────────────────────────

export function EventDetailSkeleton() {
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      <SkeletonBox width="70%" height={18} />
      <SkeletonBox width={200} height={180} radius={borderRadius.md} style={{ alignSelf: 'center' }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.avatarRow}>
          <SkeletonBox width={36} height={36} radius={18} />
          <View style={styles.rowLines}>
            <SkeletonBox width="55%" height={13} />
            <SkeletonBox width="35%" height={11} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Feed post ────────────────────────────────────────────────────────────────

export function FeedPostSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.feedPost, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.avatarRow}>
        <SkeletonBox width={40} height={40} radius={20} />
        <View style={styles.rowLines}>
          <SkeletonBox width="40%" height={13} />
          <SkeletonBox width="25%" height={11} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBox width="90%" height={13} style={{ marginTop: spacing.sm }} />
      <SkeletonBox width="75%" height={13} style={{ marginTop: 6 }} />
      <SkeletonBox width="100%" height={160} radius={borderRadius.md} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

// ─── Pin detail (body of the pin sheet) ───────────────────────────────────────

export function PinDetailSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md }}>
      <View style={{ gap: 6 }}>
        <SkeletonBox width="25%" height={11} />
        <SkeletonBox width="90%" height={13} style={{ marginTop: 4 }} />
        <SkeletonBox width="75%" height={13} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
        <SkeletonBox width={36} height={36} radius={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="40%" height={13} />
          <SkeletonBox width="28%" height={11} />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <SkeletonBox width="20%" height={11} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} width={80} height={80} radius={8} />
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <SkeletonBox width="22%" height={11} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <SkeletonBox width={32} height={32} radius={6} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="35%" height={11} />
            <SkeletonBox width="22%" height={10} />
          </View>
        </View>
      </View>

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
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLines: { flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 59,
    gap: spacing.sm,
  },
  rowLines: { flex: 1 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chatWrap: { flex: 1, padding: spacing.md, gap: spacing.sm },
  chatRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm },
  chatRowOwn: { justifyContent: 'flex-end' },
  profileWrap: { flex: 1, paddingTop: spacing.lg },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  profileHeaderLines: { flex: 1 },
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
