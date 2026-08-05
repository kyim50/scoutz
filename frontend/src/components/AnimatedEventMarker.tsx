import React, { useEffect, useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { shadows } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

export type EventMarkerVariant = 'default' | 'highTrust';

export interface AnimatedEventMarkerProps {
  iconName: string;
  isLive: boolean;
  category: string;
  onPress?: () => void;
  variant?: EventMarkerVariant;
  label?: string;
  isNew?: boolean;           // created within last 24h
  zoom?: number;             // current map zoom level
  attendeeCount?: number;    // current_attendees for avatar stack
  attendeeInitials?: string[]; // up to 3 initials to display
}

const SIZE_DEFAULT = 30;
const SIZE_HIGH_TRUST = 36;
const ICON_DEFAULT = 15;
const ICON_HIGH_TRUST = 18;
const PULSE_RING_SIZE = 48;

function zoomScale(zoom?: number): number {
  if (zoom == null) return 1;
  return Math.max(0.7, Math.min(1.25, 0.7 + (zoom - 10) * (0.55 / 8)));
}

// Pastel avatar colors keyed by first char
const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EF4444', '#F59E0B'];
function avatarColor(initial: string) {
  return AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function AnimatedEventMarker({
  iconName,
  isLive,
  category,
  onPress,
  variant = 'default',
  label,
  isNew = false,
  zoom,
  attendeeCount = 0,
  attendeeInitials = [],
}: AnimatedEventMarkerProps) {
  const { colors, isDarkMode } = useTheme();
  const isHighTrust = variant === 'highTrust';
  const zs = zoomScale(zoom);
  const size = Math.round((isHighTrust ? SIZE_HIGH_TRUST : SIZE_DEFAULT) * zs);
  const iconSize = Math.round((isHighTrust ? ICON_HIGH_TRUST : ICON_DEFAULT) * zs);

  const showAvatars = isLive && attendeeCount > 0 && attendeeInitials.length > 0;
  const visibleInitials = attendeeInitials.slice(0, 3);
  const overflow = attendeeCount - visibleInitials.length;

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(isLive ? 0.6 : 0.35);

  // Entrance
  const entranceScale = useSharedValue(0);
  const entranceOpacity = useSharedValue(0);
  // Idle bob
  const bobY = useSharedValue(0);

  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 120 });
    entranceScale.value = withSpring(1, { damping: 10, stiffness: 180, mass: 0.6 });
    bobY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0,  { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (isLive) {
      pulseScale.value = withRepeat(
        withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    } else {
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0.15, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [isLive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [
      { scale: entranceScale.value },
      { translateY: bobY.value },
    ] as const,
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          alignItems: 'center',
          paddingBottom: label ? 14 : 0,
        },
        container: {
          width: PULSE_RING_SIZE,
          height: PULSE_RING_SIZE,
          justifyContent: 'center',
          alignItems: 'center',
        },
        pulseRing: {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isLive ? '#EF4444' : colors.accent,
        },
        marker: {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDarkMode ? '#1A2520' : colors.white,
          borderWidth: 2,
          borderColor: isLive ? '#EF4444' : colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
        },
        liveBadge: {
          position: 'absolute',
          top: 0,
          right: 0,
          backgroundColor: '#EF4444',
          borderRadius: 5,
          paddingHorizontal: 4,
          paddingVertical: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          borderWidth: 1,
          borderColor: '#fff',
        },
        liveDot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#fff',
        },
        liveBadgeText: {
          color: '#fff',
          fontSize: 7,
          fontWeight: '800',
          letterSpacing: 0.3,
        },
        newBadge: {
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#10B981',
          borderRadius: 5,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderWidth: 1,
          borderColor: '#fff',
        },
        newBadgeText: {
          color: '#fff',
          fontSize: 7,
          fontWeight: '800',
          letterSpacing: 0.3,
        },
        // Attendee avatar stack sits just below the marker
        avatarRow: {
          flexDirection: 'row',
          marginTop: 3,
          alignItems: 'center',
        },
        avatar: {
          width: 14,
          height: 14,
          borderRadius: 7,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#fff',
          marginLeft: -4,
        },
        avatarText: {
          color: '#fff',
          fontSize: 6,
          fontWeight: '800',
        },
        overflowAvatar: {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: 'rgba(0,0,0,0.25)',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#fff',
          marginLeft: -4,
        },
        overflowText: {
          color: '#fff',
          fontSize: 6,
          fontWeight: '800',
        },
      }),
    [colors, isDarkMode, size, isLive]
  );

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onPress?.();
  };

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <View style={styles.container}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.marker}>
            <Ionicons
              name={iconName as any}
              size={iconSize}
              color={isLive ? '#EF4444' : colors.accent}
            />
          </View>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isNew && !isLive && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        {showAvatars && (
          <View style={styles.avatarRow}>
            {visibleInitials.map((initial, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: avatarColor(initial), zIndex: 3 - i }]}>
                <Text style={styles.avatarText}>{initial.toUpperCase()}</Text>
              </View>
            ))}
            {overflow > 0 && (
              <View style={styles.overflowAvatar}>
                <Text style={styles.overflowText}>+{overflow}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
