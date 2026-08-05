import React, { useEffect, useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const URGENT_TYPES = new Set(['hazard', 'safety']);

const TYPE_COLORS: Record<string, { border: string; icon: string; bg: string; bgDark: string; pulse: string }> = {
  hazard:        { border: '#EF4444', icon: '#EF4444', bg: '#FEF2F2', bgDark: '#2D1515', pulse: '#EF4444' },
  safety:        { border: '#3B82F6', icon: '#3B82F6', bg: '#EFF6FF', bgDark: '#1E2A3D', pulse: '#3B82F6' },
  food_status:   { border: '#F97316', icon: '#F97316', bg: '#FFF7ED', bgDark: '#2D1F0E', pulse: '#F97316' },
  campus_update: { border: '#8B5CF6', icon: '#8B5CF6', bg: '#F5F3FF', bgDark: '#211A38', pulse: '#8B5CF6' },
  accessibility: { border: '#10B981', icon: '#10B981', bg: '#ECFDF5', bgDark: '#0E2A20', pulse: '#10B981' },
  default:       { border: '#F59E0B', icon: '#F59E0B', bg: '#FFFBEB', bgDark: '#2A2008', pulse: '#F59E0B' },
};

function getTypeColor(type: string, isDark: boolean) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.default;
  return { ...c, bg: isDark ? c.bgDark : c.bg };
}

const SIZE = 30;
const ICON_SIZE = 15;
const PULSE_RING_SIZE = 50;

interface ReportMarkerProps {
  iconName: string;
  type: string;
  onPress?: () => void;
}

export default function ReportMarker({ iconName, type, onPress }: ReportMarkerProps) {
  const { isDarkMode } = useTheme();
  const tc = getTypeColor(type, isDarkMode);
  const isUrgent = URGENT_TYPES.has(type);

  // Entrance
  const entranceScale = useSharedValue(0);
  const entranceOpacity = useSharedValue(0);
  // Bob
  const bobY = useSharedValue(0);
  // Pulse ring
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 120 });
    entranceScale.value = withSpring(1, { damping: 9, stiffness: 180, mass: 0.6 });

    bobY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0,  { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );

    if (isUrgent) {
      pulseScale.value = withRepeat(
        withTiming(2.0, { duration: 1400, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }
  }, []);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [
      { scale: entranceScale.value },
      { translateY: bobY.value },
    ] as const,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onPress?.();
  };

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      width: PULSE_RING_SIZE,
      height: PULSE_RING_SIZE,
    },
    pulseRing: {
      position: 'absolute',
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: tc.pulse,
    },
    marker: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: tc.bg,
      borderWidth: 2,
      borderColor: tc.border,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.sm,
    },
  }), [tc]);

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {isUrgent && <Animated.View style={[styles.pulseRing, pulseStyle]} />}
        <View style={styles.marker}>
          <Ionicons name={iconName as any} size={ICON_SIZE} color={tc.icon} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
