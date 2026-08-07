import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated from 'react-native-reanimated';
import { useSheetModal } from '../hooks/useSheetModal';
import { spacing, borderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';

/** Taller than any keyboard, so the sheet never reveals a gap beneath it. */
const SHEET_TAIL_HEIGHT = 600;

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export default function LoginModal({ visible, onClose, onSwitchToSignup }: LoginModalProps) {
  const { showToast, showAlert } = useAlert();
  const [identifier, setIdentifier] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, forgotPassword } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    sheetStyle,
    backdropStyle,
    onSheetLayout,
    animateIn,
    close: animateAndClose,
    runAfterClose,
  } = useSheetModal({ visible, onClose });

  const identifierInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);



  useEffect(() => {
    if (visible) {
      setStep(0);
      setIdentifier('');
      setPassword('');
      setShowPassword(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step === 1) {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [visible, step]);


  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: spacing.lg,
          overflow: 'hidden',
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        backButton: {
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: borderRadius.round,
        },
        dotRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textMuted,
        },
        dotActive: { backgroundColor: colors.text },
        // Eyebrow: small, uppercase and tracked out, so it reads as a label
        // for the question below rather than competing with it.
        intro: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: colors.textMuted,
          marginBottom: spacing.xs,
        },
        title: {
          fontSize: 32,
          fontWeight: '700',
          color: colors.text,
          // Large display text needs negative tracking or it reads loose.
          letterSpacing: -0.9,
          lineHeight: 38,
          marginBottom: spacing.md,
          maxWidth: 320,
        },
        fieldWrap: { marginBottom: spacing.sm },
        input: {
          height: 48,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.borderDark,
          backgroundColor: colors.surfaceGray,
          color: colors.text,
          fontSize: 17,
          paddingHorizontal: spacing.md,
          paddingVertical: 0,
          textAlignVertical: 'center',
        },
        passwordWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.borderDark,
        },
        passwordInput: {
          flex: 1,
          height: 48,
          paddingHorizontal: spacing.md,
          paddingVertical: 0,
          color: colors.text,
          fontSize: 17,
          textAlignVertical: 'center',
        },
        eyeIcon: { paddingHorizontal: spacing.md },
        bottom: { marginTop: 'auto', paddingBottom: spacing.sm },
        actionButton: {
          height: 52,
          backgroundColor: colors.borderDark,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        actionEnabled: { backgroundColor: colors.interactiveBg },
        actionText: { fontSize: 17, color: colors.textMuted, fontWeight: '600', letterSpacing: -0.2 },
        actionTextEnabled: { color: colors.interactiveText },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.lg,
        },
        footerText: { fontSize: 13, color: colors.textSecondary },
        signupLink: { fontSize: 13, color: colors.text, fontWeight: '700' },
        forgotButton: {
          alignSelf: 'center',
          // Padding rather than height, to keep the 44pt touch target without
          // visually crowding the primary action above it.
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginTop: 4,
        },
        forgotText: { fontSize: 13, color: colors.textSecondary },
      }),
    [colors]
  );

  const handleForgotPassword = async () => {
    const email = identifier.trim();
    if (!email.includes('@')) {
      // Reset is keyed on email; a username gives Supabase nothing to send to.
      showToast('Go back and enter your email address to reset your password', 'error');
      setStep(0);
      return;
    }

    setSendingReset(true);
    try {
      await forgotPassword(email);
      // Queued so the alert doesn't present over a still-dismissing modal.
      animateAndClose(() =>
        showAlert(
          'Check your email',
          `If an account exists for ${email}, a reset link is on its way. Open it on this device to set a new password.`
        )
      );
    } catch (error: any) {
      showToast(error?.message ?? 'Could not send the reset email. Try again.', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      animateAndClose();
    } catch (error: any) {
      showToast(error?.message ?? 'Invalid email or password. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = step === 0 ? identifier.trim().length > 0 : password.trim().length > 0;

  const handleNext = async () => {
    if (step === 0) {
      if (!identifier.trim()) {
        showToast('Please enter your email or username', 'error');
        return;
      }
      setStep(1);
      return;
    }
    await handleLogin();
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(0);
    } else {
      animateAndClose();
    }
  };

  const handleShow = () => {
    animateIn();
    // Focused immediately, not after the entry finishes: the keyboard then
    // rises alongside the sheet as one motion. Delaying it made the sheet
    // settle first and then jump again when the keyboard arrived.
    identifierInputRef.current?.focus();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={handleShow}
      onDismiss={runAfterClose}
    >
      <View style={{ flex: 1 }}>
        {/* Dim overlay — absoluteFill, pointer-events none so touches pass through */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.6)' },
            backdropStyle,
          ]}
        />

        {/* Flexible dismiss area above the sheet */}
        <Pressable style={{ flex: 1 }} onPress={() => animateAndClose()} />

        {/* Anchored to the bottom and moved entirely by transform — see
            SignupModal for the full reasoning. */}
        <Reanimated.View
          style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, sheetStyle]}
        >
          <View
            onLayout={onSheetLayout}
            style={[styles.sheet, { paddingTop: 18, paddingBottom: insets.bottom + 10 }]}
          >
            <View style={styles.topRow}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.dotRow}>
                <View style={[styles.dot, step === 0 && styles.dotActive]} />
                <View style={[styles.dot, step === 1 && styles.dotActive]} />
              </View>
            </View>

            <Text style={styles.intro}>Welcome back</Text>
            <Text style={styles.title}>
              {step === 0 ? 'Enter your email' : 'Enter your password'}
            </Text>

            <View style={styles.fieldWrap}>
              {step === 0 && (
                <TextInput
                  ref={identifierInputRef}
                  style={styles.input}
                  placeholder="your@email.com or @handle"
                  placeholderTextColor={colors.textMuted}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => identifier.trim() && setStep(1)}
                />
              )}
              {step === 1 && (
                <View style={styles.passwordWrap}>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.passwordInput}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.bottom}>
              <TouchableOpacity
                style={[styles.actionButton, canProceed && !loading && styles.actionEnabled]}
                onPress={handleNext}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={colors.interactiveText} />
                ) : (
                  <Text style={[styles.actionText, canProceed && styles.actionTextEnabled]}>
                    {step === 0 ? 'Next' : 'Log in'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Shown on the password step, where someone discovers they've
                  forgotten it. This is also the only route back in for accounts
                  that predate the Supabase Auth migration. */}
              {step === 1 && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={handleForgotPassword}
                  disabled={sendingReset}
                  accessibilityRole="button"
                  accessibilityLabel="Reset your password by email"
                >
                  {sendingReset ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Text style={styles.forgotText}>Forgot your password?</Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={onSwitchToSignup}>
                  <Text style={styles.signupLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Covers the space the keyboard vacates, positioned absolutely so it
              adds nothing to the container's height — as a flow child it made
              the container taller than the sheet, and with the container
              anchored to the bottom that pushed the sheet off screen. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              height: SHEET_TAIL_HEIGHT,
              backgroundColor: colors.surface,
            }}
          />
        </Reanimated.View>
      </View>
    </Modal>
  );
}
