import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface ConfirmEmailStepProps {
  email: string;
  /** Re-runs signup to send another confirmation email. */
  onResend: () => Promise<void>;
  onBackToLogin: () => void;
}

/** How long before the resend button becomes available again. */
const RESEND_COOLDOWN_S = 30;

/**
 * Terminal step of signup when the project requires email confirmation.
 *
 * The account exists but has no session yet, so there is nothing to navigate
 * to — the user has to leave for their inbox and come back. This screen is
 * genuinely a waiting state, and it says so: the halo keeps moving to signal
 * the app is still listening, rather than showing a spinner that implies work
 * is happening here.
 *
 * Confirming arrives back as a deep link, which AuthContext turns into a
 * session. This screen does not need to poll or dismiss itself — the navigator
 * switches stacks as soon as the user exists.
 */
export default function ConfirmEmailStep({
  email,
  onResend,
  onBackToLogin,
}: ConfirmEmailStepProps) {
  const { colors } = useTheme();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resentOnce, setResentOnce] = useState(false);

  const halo = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    // Two loops at different periods so the motion never reads as a
    // mechanical repeat: the halo pushes outward, the envelope drifts.
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    lift.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(halo);
      cancelAnimation(lift);
    };
  }, [halo, lift]);

  // Counts down to re-enable resend, so the button is never a dead press.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + halo.value * 0.9 }],
    opacity: (1 - halo.value) * 0.35,
  }));

  const envelopeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value * -6 }],
  }));

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setResentOnce(true);
      setCooldown(RESEND_COOLDOWN_S);
    } finally {
      setResending(false);
    }
  }, [cooldown, resending, onResend]);

  /** Opens the default mail client rather than making the user go find it. */
  const handleOpenMail = useCallback(() => {
    Linking.openURL('message://').catch(() => {
      Linking.openURL('mailto:').catch(() => {});
    });
  }, []);

  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, alignItems: 'center', paddingTop: spacing.lg },
        haloBase: {
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.accent,
        },
        iconWrap: {
          width: 96,
          height: 96,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        },
        iconCircle: {
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        eyebrow: {
          ...typography.labelSmall,
          color: colors.accent,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
        },
        title: {
          fontSize: 28,
          lineHeight: 34,
          fontWeight: '700',
          letterSpacing: -0.5,
          color: colors.text,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
        body: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: 21,
          maxWidth: 300,
        },
        email: { color: colors.text, fontWeight: '600' },
        confirmed: {
          ...typography.caption,
          color: colors.success,
          marginTop: spacing.sm,
        },
        bottom: { marginTop: 'auto', width: '100%', gap: spacing.xs },
        primary: {
          height: 52,
          borderRadius: borderRadius.md,
          backgroundColor: colors.interactiveBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        primaryText: { fontSize: 17, fontWeight: '700', color: colors.interactiveText },
        secondary: {
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        secondaryText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        secondaryDisabled: { color: colors.textMuted },
        footerRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 44,
        },
        footerText: { ...typography.caption, color: colors.textSecondary },
        footerLink: { ...typography.captionBold, color: colors.text },
      }),
    [colors]
  );

  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}>
        <Reanimated.View style={[s.haloBase, haloStyle]} pointerEvents="none" />
        <Reanimated.View style={envelopeStyle}>
          <View style={s.iconCircle}>
            <Ionicons name="mail-outline" size={34} color={colors.accent} />
          </View>
        </Reanimated.View>
      </View>

      <Text style={s.eyebrow}>Almost there</Text>
      <Text style={s.title}>Check your email</Text>
      <Text style={s.body}>
        We sent a confirmation link to <Text style={s.email}>{email}</Text>. Tap it and
        you&apos;ll be signed in automatically.
      </Text>

      {resentOnce && (
        <Text style={s.confirmed}>Sent again — it can take a minute to arrive.</Text>
      )}

      <View style={s.bottom}>
        <TouchableOpacity
          style={s.primary}
          onPress={handleOpenMail}
          accessibilityRole="button"
          accessibilityLabel="Open your mail app"
        >
          <Ionicons name="open-outline" size={18} color={colors.interactiveText} />
          <Text style={s.primaryText}>Open Mail</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondary}
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
          accessibilityRole="button"
          accessibilityLabel={
            cooldown > 0 ? `Resend available in ${cooldown} seconds` : 'Resend confirmation email'
          }
          accessibilityState={{ disabled: cooldown > 0 || resending }}
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={[s.secondaryText, cooldown > 0 && s.secondaryDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it? Resend"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={s.footerRow}>
          <Text style={s.footerText}>Already confirmed? </Text>
          <TouchableOpacity onPress={onBackToLogin} accessibilityRole="button">
            <Text style={s.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
