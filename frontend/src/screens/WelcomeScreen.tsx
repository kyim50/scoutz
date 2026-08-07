import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import LoginModal from '../components/LoginModal';
import SignupModal from '../components/SignupModal';

const { height } = Dimensions.get('window');

// LinearGradient interpolates in RGBA, so a fade has to carry the target colour's
// own channels at every stop — starting from 'transparent' drags the midpoint
// through black.
const rgbaFrom = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const SAMPLE_CARDS = [
  { id: 1, size: 'large' },
  { id: 2, size: 'small' },
  { id: 3, size: 'medium' },
  { id: 4, size: 'small' },
  { id: 5, size: 'large' },
  { id: 6, size: 'medium' },
];

interface WelcomeScreenProps {
  navigation: any;
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        cardGrid: { flex: 1, flexDirection: 'row', paddingHorizontal: spacing.xs, paddingTop: spacing.lg },
        column: { flex: 1, paddingHorizontal: spacing.xs },
        card: {
          marginBottom: spacing.sm,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
        },
        cardInner: {
          flex: 1,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceHigh,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardOverlay: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
        },
        markerWrap: {
          position: 'absolute',
          width: 24,
          height: 24,
          justifyContent: 'center',
          alignItems: 'center',
        },
        zoneGlow: {
          position: 'absolute',
          width: 86,
          height: 86,
          borderRadius: 43,
          backgroundColor: 'rgba(40, 184, 115, 0.06)',
        },
        block: {
          position: 'absolute',
          width: 26,
          height: 12,
          borderRadius: 6,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: colors.border,
        },
        tinyDot: {
          position: 'absolute',
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.textMuted,
        },
        pulseRing: {
          position: 'absolute',
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: 'rgba(40, 184, 115, 0.55)',
          backgroundColor: 'rgba(40, 184, 115, 0.1)',
        },
        marker: {
          position: 'absolute',
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: '#28B873',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
        },
        contentOverlay: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          justifyContent: 'flex-end',
          alignItems: 'center',
          zIndex: 2,
          paddingHorizontal: spacing.lg,
        },
        textContainer: { alignItems: 'center', marginBottom: spacing.lg },
        title: {
          fontSize: 44,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
          marginBottom: spacing.sm,
          lineHeight: 50,
          letterSpacing: -1.5,
        },
        subtitle: {
          ...typography.body,
          color: colors.textSecondary,
          textAlign: 'center',
          maxWidth: 260,
          lineHeight: 22,
          fontSize: 15,
        },
        buttonContainer: { width: '100%', alignItems: 'center' },
        signupButton: {
          width: '100%',
          backgroundColor: colors.interactiveBg,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          marginBottom: spacing.sm + 2,
        },
        signupButtonText: { fontSize: 16, fontWeight: '700', color: colors.interactiveText, letterSpacing: -0.2 },
        loginButton: {
          width: '100%',
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        loginButtonText: { fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
        termsText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 16 },
        termsLink: { fontWeight: '600', color: colors.textSecondary },
      }),
    [colors]
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(
    SAMPLE_CARDS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      100,
      cardAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      )
    ).start();

    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    makePulse(pulseA, 0).start();
    makePulse(pulseB, 700).start();
  }, []);

  const renderCard = (card: any, index: number) => {
    const cardAnim = cardAnims[index];
    const scale = cardAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
    });

    const getCardStyle = () => {
      const baseStyle = {
        ...styles.card,
        transform: [{ scale }],
      };

      switch (card.size) {
        case 'large':
          return { ...baseStyle, height: 220 };
        case 'medium':
          return { ...baseStyle, height: 180 };
        case 'small':
          return { ...baseStyle, height: 140 };
        default:
          return baseStyle;
      }
    };

    const ringScaleA = pulseA.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
    const ringOpacityA = pulseA.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.35, 0.15, 0] });
    const ringScaleB = pulseB.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
    const ringOpacityB = pulseB.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.35, 0.15, 0] });

    const markerLayouts = [
      { top: '24%', left: '18%' },
      { top: '30%', right: '20%' },
      { top: '42%', left: '14%' },
      { bottom: '18%', right: '16%' },
    ] as const;

    const current = markerLayouts[index % markerLayouts.length];

    const renderMarker = (pos: ViewStyle, useAltPulse: boolean) => (
      <View style={[styles.markerWrap, pos]}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: useAltPulse ? ringScaleB : ringScaleA }],
              opacity: useAltPulse ? ringOpacityB : ringOpacityA,
            },
          ]}
        />
        <View style={styles.marker}>
          <Ionicons name="location-sharp" size={10} color="#0B1016" />
        </View>
      </View>
    );

    const renderDecorations = () => (
      <View style={styles.cardOverlay} pointerEvents="none">
        <View style={[styles.zoneGlow, index % 2 === 0 ? { top: '-10%', right: '-10%' } : { bottom: '-10%', left: '-8%' }]} />
        <View style={[styles.block, { top: '20%', left: '14%' }]} />
        <View style={[styles.block, { top: '38%', right: '18%', width: 20 }]} />
        <View style={[styles.block, { bottom: '20%', left: '22%', width: 30 }]} />
        <View style={[styles.tinyDot, { top: '58%', left: '62%' }]} />
        <View style={[styles.tinyDot, { top: '30%', left: '48%' }]} />
        <View style={[styles.tinyDot, { bottom: '26%', right: '20%' }]} />
        {index % 2 === 0 ? renderMarker(current, false) : null}
        {index % 4 === 3 ? renderMarker(current, true) : null}
      </View>
    );

    return (
      <Animated.View key={card.id} style={getCardStyle()}>
        <View style={styles.cardInner}>{renderDecorations()}</View>
      </Animated.View>
    );
  };

  const backgroundGradient = [colors.surfaceGray, colors.surface, colors.surface] as const;
  const overlayGradient = [
    rgbaFrom(colors.surface, 0),
    rgbaFrom(colors.surface, isDarkMode ? 0.86 : 0.4),
    colors.surface,
  ] as const;

  return (
    <LinearGradient
      colors={backgroundGradient}
      style={styles.container}
    >
      {/* Card Grid */}
      <View style={styles.cardGrid}>
        <View style={styles.column}>
          {SAMPLE_CARDS.filter((_, i) => i % 2 === 0).map((card, index) =>
            renderCard(card, index * 2)
          )}
        </View>
        <View style={styles.column}>
          {SAMPLE_CARDS.filter((_, i) => i % 2 === 1).map((card, index) =>
            renderCard(card, index * 2 + 1)
          )}
        </View>
      </View>

      {/* Gradient overlay (dark: fades to black; light: fades to background so text stays readable) */}
      <LinearGradient
        colors={overlayGradient}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.66,
          zIndex: 1,
        }}
        pointerEvents="none"
      />

      {/* Content Overlay */}
      <Animated.View
        style={[
          styles.contentOverlay,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Main Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Discover your{'\n'}community</Text>
          <Text style={styles.subtitle}>
            Find places, join events, and connect with your neighborhood
          </Text>
        </Animated.View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => setShowSignup(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.signupButtonText}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => setShowLogin(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.loginButtonText}>Log in</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By continuing, you agree to Cite's{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              Terms of Service
            </Text>
            {' '}and acknowledge you've read our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </Animated.View>
      <LoginModal
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
      />
      <SignupModal
        visible={showSignup}
        onClose={() => setShowSignup(false)}
        onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
      />
    </LinearGradient>
  );
}
