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
  /** Re-runs signup so Supabase issues another confirmation email. */
  onResend: () => Promise<void>;
  onBackToLogin: () => void;
}

/** How long before the resend button becomes available again. */
const RESEND_COOLDOWN_S = 30;

/**
 * The halo starts at exactly the icon's size and expands outward, so it reads
 * as a ripple leaving the envelope. Sized larger than the icon it just looked
 * like a big disc with a small dot in the middle.
 */
const ICON_SIZE = 72;
const RIPPLE_PERIOD_MS = 2200;

/**
 * Terminal step of signup when the project requires email confirmation.
 *
 * The account exists but has no session, so there is nothing to navigate to —
 * the user has to leave for their inbox and come back. This is genuinely a
 * waiting state and says so: the halo keeps moving to show the app is still
 * listening, rather than a spinner implying work is happening here.
 *
 * Confirming arrives back as a deep link, which AuthContext turns into a
 * session. This screen never polls or dismisses itself — the navigator switches
 * stacks as soon as the user exists.
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

  // Two ripples half a period apart, so there is always one mid-flight and the
  // motion reads as continuous rather than as a repeating blink.
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    // Expands and fades. Fully transparent at the end of each cycle, so the
    // instant reset back to the start is never seen.
    const ripple = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: RIPPLE_PERIOD_MS, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );

    ripple1.value = ripple();
    ripple2.value = withDelay(RIPPLE_PERIOD_MS / 2, ripple());
    // Offset and on a different period, so the two never lock into a
    // mechanical repeat.
    lift.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
      cancelAnimation(lift);
    };
  }, [ripple1, ripple2, lift]);

  // Counts down to re-enable resend, so the button is never a dead press.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 1.15 }],
    opacity: (1 - ripple1.value) * 0.22,
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 1.15 }],
    opacity: (1 - ripple2.value) * 0.22,
  }));

  const envelopeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value * -5 }],
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
        // No flex:1 or marginTop:auto — the sheet sizes to its content, so
        // those collapse instead of distributing space. Rhythm comes from
        // explicit spacing between groups.
        wrap: { alignItems: 'center', paddingTop: spacing.md },

        haloWrap: {
          width: ICON_SIZE,
          height: ICON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
        },
        halo: {
          // Pinned to all four edges so it is exactly centred on the icon and
          // starts at the icon's own size. Absolute positioning without insets
          // lays out from the top-left, which made the pulse expand off-centre.
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: ICON_SIZE / 2,
          backgroundColor: colors.accent,
        },
        iconCircle: {
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE / 2,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        },

        eyebrow: {
          ...typography.labelSmall,
          color: colors.accent,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: spacing.sm,
        },
        title: {
          fontSize: 26,
          lineHeight: 32,
          fontWeight: '700',
          letterSpacing: -0.6,
          color: colors.text,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
        body: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: 21,
          // Keeps the line length comfortable instead of spanning the sheet.
          maxWidth: 290,
        },
        // On its own line. Inline, a long address wrapped mid-sentence and
        // split the instruction across the break.
        email: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
        },
        hint: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 17,
        },

        // Reserved height so the layout doesn't shift when this appears.
        noticeSlot: {
          height: 20,
          justifyContent: 'center',
          marginTop: spacing.sm,
        },
        notice: { ...typography.caption, color: colors.success, textAlign: 'center' },

        actions: {
          width: '100%',
          marginTop: spacing.lg,
          gap: spacing.sm,
        },
        primary: {
          height: 52,
          borderRadius: borderRadius.md,
          backgroundColor: colors.interactiveBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        primaryText: { fontSize: 17, fontWeight: '600', color: colors.interactiveText },
        resend: {
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        resendText: { ...typography.bodySmallMedium, color: colors.text },
        resendDisabled: { color: colors.textMuted },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          width: '100%',
          marginTop: spacing.xs,
        },
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
      <View style={s.haloWrap}>
        <Reanimated.View style={[s.halo, ripple1Style]} pointerEvents="none" />
        <Reanimated.View style={[s.halo, ripple2Style]} pointerEvents="none" />
        <Reanimated.View style={envelopeStyle}>
          <View style={s.iconCircle}>
            <Ionicons name="mail-outline" size={32} color={colors.accent} />
          </View>
        </Reanimated.View>
      </View>

      <Text style={s.eyebrow}>Almost there</Text>
      <Text style={s.title}>Check your email</Text>
      <Text style={s.body}>We sent a confirmation link to</Text>
      <Text style={s.email} numberOfLines={1} ellipsizeMode="middle">
        {email}
      </Text>
      <Text style={s.hint}>Tap it and you&apos;ll be signed in automatically.</Text>

      <View style={s.noticeSlot}>
        {resentOnce ? (
          <Text style={s.notice}>Sent again — it can take a minute to arrive.</Text>
        ) : null}
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={s.primary}
          onPress={handleOpenMail}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Open your mail app"
        >
          <Ionicons name="open-outline" size={18} color={colors.interactiveText} />
          <Text style={s.primaryText}>Open Mail</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.resend}
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
            <Text style={[s.resendText, cooldown > 0 && s.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it? Resend"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={s.divider} />

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
