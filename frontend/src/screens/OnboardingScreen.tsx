import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const ACCENT = '#28B873';

const slides = [
  {
    id: '1',
    badge: 'Explore',
    title: 'Discover your\nsurroundings',
    description: 'Find bathrooms, food spots, study areas, and more — just search in plain English.',
    icon: 'map' as const,
    chips: [
      { icon: 'cafe-outline' as const, label: 'Coffee Spots' },
      { icon: 'book-outline' as const, label: 'Study Zones' },
      { icon: 'restaurant-outline' as const, label: 'Food Nearby' },
    ],
  },
  {
    id: '2',
    badge: 'Events',
    title: "Join what's\nhappening now",
    description: 'Discover study groups, social events, and club meetings happening all around you.',
    icon: 'calendar' as const,
    chips: [
      { icon: 'people-outline' as const, label: 'Study Groups' },
      { icon: 'musical-notes-outline' as const, label: 'Live Events' },
      { icon: 'flag-outline' as const, label: 'Club Meets' },
    ],
  },
  {
    id: '3',
    badge: 'Contribute',
    title: 'Drop a pin,\nearn reputation',
    description: 'Long-press the map or tap + to add bathrooms, food spots, study spaces — earn +5 rep per pin and unlock badges.',
    icon: 'location' as const,
    chips: [
      { icon: 'add-circle-outline' as const, label: '+5 per pin' },
      { icon: 'shield-checkmark-outline' as const, label: 'Verify spots' },
      { icon: 'trophy-outline' as const, label: 'Earn badges' },
    ],
  },
];

interface OnboardingScreenProps {
  navigation: any;
  onComplete?: () => void;
}

export default function OnboardingScreen({ navigation, onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0]?.index ?? 0);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const finishOnboarding = () => {
    if (onComplete) onComplete();
    navigation.navigate('Welcome');
  };

  const scrollTo = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        slide: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        },
        slideContent: { alignItems: 'center', width: '100%' },
        badge: {
          backgroundColor: 'rgba(40, 184, 115, 0.12)',
          borderWidth: 1,
          borderColor: 'rgba(40, 184, 115, 0.24)',
          borderRadius: borderRadius.round,
          paddingHorizontal: 12,
          paddingVertical: 4,
          marginBottom: spacing.md,
        },
        badgeText: {
          ...typography.captionMedium,
          color: ACCENT,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        visualCard: {
          width: 168,
          height: 168,
          borderRadius: 30,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: colors.borderLight,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
          overflow: 'hidden',
        },
        iconGlow: {
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: 'rgba(40, 184, 115, 0.10)',
        },
        decoDot: {
          position: 'absolute',
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.mediumGray,
        },
        decoBlock: {
          position: 'absolute',
          width: 26,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.borderLight,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: {
          fontSize: 30,
          fontWeight: '700',
          color: colors.text,
          lineHeight: 36,
          letterSpacing: -1,
          textAlign: 'center',
          marginBottom: spacing.xs,
        },
        description: {
          ...typography.body,
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
          paddingHorizontal: spacing.md,
        },
        footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
        pagination: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
          gap: spacing.xs,
        },
        dot: { height: 6, borderRadius: 3, backgroundColor: ACCENT },
        ctaButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          marginBottom: spacing.sm,
        },
        ctaText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.interactiveText,
          letterSpacing: -0.2,
        },
        skipBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
        skipText: { ...typography.body, color: colors.textMuted },
      }),
    [colors]
  );

  const renderItem = ({ item, index }: { item: typeof slides[0]; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [24, 0, 24],
      extrapolate: 'clamp',
    });

    return (
      <View style={[s.slide, { width }]}>
        <Animated.View style={[s.slideContent, { opacity, transform: [{ translateY }] }]}>
          {/* Feature badge */}
          <View style={s.badge}>
            <Text style={s.badgeText}>{item.badge}</Text>
          </View>

          {/* Visual card */}
          <View style={s.visualCard}>
            <View style={s.iconGlow} />
            <Ionicons name={item.icon} size={60} color={ACCENT} />
            <View style={[s.decoDot, { top: 22, right: 28 }]} />
            <View style={[s.decoDot, { bottom: 28, left: 22 }]} />
            <View style={[s.decoDot, { top: '50%', left: 18 }]} />
            <View style={[s.decoBlock, { top: 30, left: 26 }]} />
            <View style={[s.decoBlock, { bottom: 24, right: 22, width: 18 }]} />
            <View style={[s.decoBlock, { top: 22, right: 50, width: 14, height: 7 }]} />
          </View>

          {/* Text */}
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.surface, paddingTop: insets.top + spacing.md }]}>
      {/* Slides */}
      <FlatList
        data={slides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
        style={{ flex: 1 }}
      />

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* Pagination */}
        <View style={s.pagination}>
          {slides.map((_, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 18, 6],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[s.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            );
          })}
        </View>

        {/* CTA button */}
        <TouchableOpacity style={s.ctaButton} onPress={scrollTo} activeOpacity={0.9}>
          <Text style={s.ctaText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>

        {currentIndex < slides.length - 1 && (
          <TouchableOpacity style={s.skipBtn} onPress={finishOnboarding} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
