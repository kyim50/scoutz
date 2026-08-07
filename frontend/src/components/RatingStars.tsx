import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

/** Warm gold, held constant across themes — a filled star reads as gold or not at all. */
export const STAR_GOLD = '#FFB800';

interface RatingStarsProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}

/**
 * The five stars, as the one thing on the review screen worth looking at.
 *
 * Rating a place happens once, so this is the rare interaction where a little
 * delight is affordable: tapping four stars fills all four in sequence rather
 * than snapping, which is what makes the tap feel like it landed. The stagger
 * is 28ms and the whole run finishes inside 240ms — long enough to read as
 * motion, short enough that nobody waits for it.
 */
export default function RatingStars({ rating, onChange, size = 40 }: RatingStarsProps) {
  const { colors } = useTheme();

  // Five explicit values rather than a mapped array: hooks cannot be called in
  // a loop whose length could ever change.
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const s5 = useSharedValue(1);
  const scales = [s1, s2, s3, s4, s5];

  const handlePress = useCallback(
    (star: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onChange(star);

      // Raising the rating fills upward, so run the pop across every star that
      // just became filled. Lowering it only disturbs the one that was tapped.
      const from = star > rating ? rating : star - 1;
      for (let i = from; i < star; i++) {
        scales[i].value = withDelay(
          (i - from) * 28,
          withSequence(
            withTiming(1.22, { duration: 110, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) })
          )
        );
      }
    },
    [rating, onChange, s1, s2, s3, s4, s5]
  );

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          star={star}
          filled={star <= rating}
          scale={scales[star - 1]}
          size={size}
          emptyColor={colors.mediumGray}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

function Star({
  star,
  filled,
  scale,
  size,
  emptyColor,
  onPress,
}: {
  star: number;
  filled: boolean;
  scale: SharedValue<number>;
  size: number;
  emptyColor: string;
  onPress: (star: number) => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={() => onPress(star)}
      // Padding rather than a fixed box: it keeps the 44pt touch target while
      // letting the stars sit close enough to read as one control.
      style={styles.hit}
      accessibilityRole="radio"
      accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
      accessibilityState={{ selected: filled }}
    >
      <Reanimated.View style={animatedStyle}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={size}
          color={filled ? STAR_GOLD : emptyColor}
        />
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'center' },
  hit: { paddingHorizontal: 5, paddingVertical: 6 },
});
