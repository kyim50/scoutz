import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Reanimated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

/** Height of the pill itself, before any safe-area padding. */
export const TAB_PILL_HEIGHT = 58;
/** Clearance between the pill and the bottom safe area. */
export const TAB_BAR_GAP = 10;

/**
 * The height a screen must leave clear at the bottom for the floating bar.
 * Exported so the map can keep its own controls above it — the bar overlays
 * content rather than reserving layout space, so nothing gets this for free.
 */
export function tabBarClearance(bottomInset: number) {
  return TAB_PILL_HEIGHT + TAB_BAR_GAP + Math.max(bottomInset, 12);
}

const ICONS: Record<string, { on: string; off: string; label: string }> = {
  Map: { on: 'map', off: 'map-outline', label: 'Map' },
  Activity: { on: 'reader', off: 'reader-outline', label: 'Activity' },
  Profile: { on: 'person', off: 'person-outline', label: 'Account' },
};

/** Long enough to read as a change, short enough not to be waited on. */
const SWITCH_MS = 190;

/**
 * A floating pill tab bar.
 *
 * It sits over the content rather than in the layout, which is why the map can
 * run to the bottom of the screen behind it. Each tab carries its own selection
 * pill that fades and scales in place rather than one pill sliding between
 * them: a slide has to measure three items of different widths and re-measure
 * whenever the labels change, and at this speed nobody can tell the difference.
 */
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: Math.max(insets.bottom, 12),
        },
        pill: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? colors.surfaceHigh : colors.surface,
          borderRadius: borderRadius.round,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDarkMode ? colors.borderDark : colors.border,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: isDarkMode ? 0.5 : 0.14,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 10 },
          }),
        },
      }),
    [colors, isDarkMode, insets.bottom]
  );

  return (
    // box-none so taps outside the pill still reach the map underneath.
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = ICONS[route.name] ?? {
            on: 'ellipse',
            off: 'ellipse-outline',
            label: route.name,
          };
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              iconName={focused ? meta.on : meta.off}
              label={meta.label}
              onPress={onPress}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  focused,
  iconName,
  label,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  iconName: string;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors, isDarkMode } = useTheme();

  const progress = useDerivedValue(
    () => withTiming(focused ? 1 : 0, { duration: SWITCH_MS, easing: Easing.out(Easing.quad) }),
    [focused]
  );

  const selectionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Never from zero: a pill that grows out of nothing reads as an object
    // appearing rather than a state turning on.
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  const activeFill = isDarkMode ? colors.lightGray : colors.backgroundGray;
  const tint = focused ? colors.text : colors.textSecondary;

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, colors.text]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
    >
      <Reanimated.View
        style={[styles.selection, { backgroundColor: activeFill }, selectionStyle]}
        pointerEvents="none"
      />
      <Ionicons name={iconName as any} size={23} color={tint} />
      <Reanimated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Reanimated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    gap: 3,
    minWidth: 76,
  },
  selection: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.round,
  },
  label: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
