import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const { showToast } = useAlert();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    backdropOpacity,
    sheetTranslateY,
    animateIn,
    close: animateAndClose,
    runAfterClose,
  } = useSheetModal({ visible, onClose });

  const identifierInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  useEffect(() => {
    if (visible) {
      setStep(0);
      setIdentifier('');
      setPassword('');
      setShowPassword(false);
    } else {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
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
        intro: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xs },
        title: {
          fontSize: 30,
          fontWeight: '700',
          color: colors.text,
          letterSpacing: -0.6,
          lineHeight: 36,
          marginBottom: spacing.md,
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
        actionText: { fontSize: 20, color: colors.textMuted, fontWeight: '700' },
        actionTextEnabled: { color: colors.interactiveText },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.lg,
        },
        footerText: { fontSize: 13, color: colors.textSecondary },
        signupLink: { fontSize: 13, color: colors.text, fontWeight: '700' },
      }),
    [colors]
  );

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
    focusTimeoutRef.current = setTimeout(() => {
      identifierInputRef.current?.focus();
      focusTimeoutRef.current = null;
    }, 380);
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
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropOpacity },
          ]}
        />

        {/* Flexible dismiss area above the sheet */}
        <Pressable style={{ flex: 1 }} onPress={() => animateAndClose()} />

        {/* Anchored to the bottom and moved entirely by transform — see
            SignupModal for the full reasoning. */}
        <Animated.View
          style={[
            { position: 'absolute', left: 0, right: 0, bottom: 0 },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={[styles.sheet, { paddingTop: 18, paddingBottom: insets.bottom + 10 }]}>
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
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={onSwitchToSignup}>
                  <Text style={styles.signupLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Rides with the sheet to cover the space the keyboard vacates. */}
          <View
            pointerEvents="none"
            style={{ height: SHEET_TAIL_HEIGHT, backgroundColor: colors.surface }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
