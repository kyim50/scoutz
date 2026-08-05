import React, { useMemo, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { shadows } from '../constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

export type PinMarkerVariant = 'default' | 'highTrust';

interface PinMarkerProps {
  iconName: string;
  type: string;
  onPress?: () => void;
  variant?: PinMarkerVariant;
  label?: string;
  selected?: boolean;
  isNew?: boolean;      // created within last 24h
  zoom?: number;        // current map zoom level
}

const SIZE_DEFAULT = 30;
const SIZE_HIGH_TRUST = 36;
const ICON_DEFAULT = 15;
const ICON_HIGH_TRUST = 18;

const CATEGORY_COLORS: Record<string, { border: string; icon: string; bg: string; bgDark: string }> = {
  bathroom:  { border: '#3B82F6', icon: '#3B82F6', bg: '#EFF6FF', bgDark: '#1E2A3D' },
  food:      { border: '#F97316', icon: '#F97316', bg: '#FFF7ED', bgDark: '#2D1F0E' },
  pharmacy:  { border: '#EF4444', icon: '#EF4444', bg: '#FEF2F2', bgDark: '#2D1515' },
  study:     { border: '#8B5CF6', icon: '#8B5CF6', bg: '#F5F3FF', bgDark: '#211A38' },
  coffee:    { border: '#92400E', icon: '#92400E', bg: '#FFFBEB', bgDark: '#2A1F08' },
  parking:   { border: '#6B7280', icon: '#6B7280', bg: '#F9FAFB', bgDark: '#1E1F21' },
  safe_walk: { border: '#10B981', icon: '#10B981', bg: '#ECFDF5', bgDark: '#0E2A20' },
  open_late: { border: '#F59E0B', icon: '#F59E0B', bg: '#FFFBEB', bgDark: '#2A2008' },
  other:     { border: '#14B8A6', icon: '#14B8A6', bg: '#F0FDFA', bgDark: '#0D2B29' },
  report:    { border: '#F59E0B', icon: '#F59E0B', bg: '#FFFBEB', bgDark: '#2A2008' },
  hazard:    { border: '#EF4444', icon: '#EF4444', bg: '#FEF2F2', bgDark: '#2D1515' },
  safety:    { border: '#3B82F6', icon: '#3B82F6', bg: '#EFF6FF', bgDark: '#1E2A3D' },
  default:   { border: '#28B873', icon: '#28B873', bg: '#ECFDF5', bgDark: '#0E2A20' },
};

function getCategoryColor(type: string, isDark: boolean) {
  const c = CATEGORY_COLORS[type] ?? CATEGORY_COLORS.default;
  return { ...c, bg: isDark ? c.bgDark : c.bg, icon: isDark ? c.border : c.icon };
}

// Derive a size multiplier from zoom level (zoom 10 = 0.7x, zoom 14 = 1x, zoom 18 = 1.25x)
function zoomScale(zoom?: number): number {
  if (zoom == null) return 1;
  return Math.max(0.7, Math.min(1.25, 0.7 + (zoom - 10) * (0.55 / 8)));
}

export default function PinMarker({ iconName, type, onPress, variant = 'default', label, selected = false, isNew = false, zoom }: PinMarkerProps) {
  const { colors, isDarkMode } = useTheme();
  const isHighTrust = variant === 'highTrust';
  const zs = zoomScale(zoom);
  const size = Math.round((isHighTrust ? SIZE_HIGH_TRUST : SIZE_DEFAULT) * zs);
  const iconSize = Math.round((isHighTrust ? ICON_HIGH_TRUST : ICON_DEFAULT) * zs);
  const catColor = getCategoryColor(type, isDarkMode);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.22);

  const startFloatingAnimation = () => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );
  };

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 150 });
    scale.value = withSpring(1, { damping: 10, stiffness: 180, mass: 0.6 });
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.22, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );
    startFloatingAnimation();
  }, []);

  useEffect(() => {
    if (selected) {
      scale.value = withSpring(1.18, { damping: 12, stiffness: 200 });
      translateY.value = withSpring(-8, { damping: 12, stiffness: 200 });
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 180 });
      startFloatingAnimation();
    }
  }, [selected]);

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 10, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(selected ? 1.18 : 1, { damping: 8, stiffness: 200 });
  };

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ] as const,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          alignItems: 'center',
          paddingBottom: label ? 14 : 0,
        },
        markerOuter: {
          padding: isHighTrust ? 2 : 0,
          borderRadius: (size / 2) + 2,
          backgroundColor: isHighTrust ? colors.pinVerified : 'transparent',
        },
        pulseRing: {
          position: 'absolute',
          top: isHighTrust ? -2 : 0,
          left: isHighTrust ? -2 : 0,
          width: size + (isHighTrust ? 4 : 0),
          height: size + (isHighTrust ? 4 : 0),
          borderRadius: (size / 2) + 2,
          backgroundColor: isHighTrust ? colors.pinVerified : catColor.border,
        },
        marker: {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: catColor.bg,
          borderWidth: 2,
          borderColor: isHighTrust ? colors.pinVerified : catColor.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        verifiedBadge: {
          position: 'absolute',
          bottom: label ? 16 : 2,
          right: -3,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.pinVerified,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: '#fff',
        },
        newDot: {
          position: 'absolute',
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#10B981',
          borderWidth: 1.5,
          borderColor: '#fff',
        },
      }),
    [colors, isDarkMode, size, isHighTrust, catColor]
  );

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.markerOuter}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.marker}>
            <Ionicons name={iconName as any} size={iconSize} color={catColor.icon} />
          </View>
        </View>
        {isHighTrust && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={8} color="#fff" />
          </View>
        )}
        {isNew && <View style={styles.newDot} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
