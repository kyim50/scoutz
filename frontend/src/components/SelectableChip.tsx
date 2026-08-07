import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SelectableChipProps {
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Fast enough to feel like a response rather than an animation. */
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 140;

/**
 * A chip that acknowledges being pressed.
 *
 * The forms previously relied on `activeOpacity` alone, which is subtle to the
 * point of being unnoticeable — a chip could be tapped with no sense that the
 * interface had registered it until the colour changed. A small scale plus a
 * light haptic is the cheapest way to make an interface feel like it is
 * listening, and it costs nothing at runtime because the scale runs on the UI
 * thread.
 *
 * The haptic fires on press-in, not on the state change, so it lands with the
 * finger rather than after the re-render.
 */
export default function SelectableChip({
  selected,
  onPress,
  style,
  children,
  accessibilityLabel,
  disabled,
}: SelectableChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.96, {
      duration: PRESS_IN_MS,
      easing: Easing.out(Easing.quad),
    });
    Haptics.selectionAsync().catch(() => {});
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, {
      duration: PRESS_OUT_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [scale]);

  const handlePress = useCallback(
    (_e: GestureResponderEvent) => {
      onPress();
    },
    [onPress]
  );

  return (
    <Reanimated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      >
        {children}
      </Pressable>
    </Reanimated.View>
  );
}
