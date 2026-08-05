import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';

interface LoginScreenProps {
  navigation: any;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { showAlert, showToast } = useAlert();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, forgotPassword } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.overlayLight,
          justifyContent: 'flex-end',
        },
        keyboardView: { flex: 1, justifyContent: 'flex-end' },
        sheet: {
          height: '74%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: StyleSheet.hairlineWidth,
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
          backgroundColor: 'transparent',
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
        dotActive: {
          backgroundColor: colors.text,
        },
        intro: {
          ...typography.bodySmallMedium,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        },
        title: {
          ...typography.h1,
          color: colors.text,
          letterSpacing: -0.6,
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
          lineHeight: 22,
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
          lineHeight: 22,
          textAlignVertical: 'center',
        },
        eyeIcon: { paddingHorizontal: spacing.md },
        bottom: {
          marginTop: 'auto',
          paddingBottom: spacing.sm,
        },
        actionButton: {
          height: 52,
          backgroundColor: colors.borderDark,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        actionEnabled: { backgroundColor: colors.interactiveBg },
        actionText: { ...typography.h4, color: colors.textMuted },
        actionTextEnabled: { color: colors.interactiveText },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.lg,
        },
        footerText: { ...typography.caption, color: colors.textSecondary },
        signupLink: { ...typography.captionBold, color: colors.text },
        forgotButton: {
          alignSelf: 'center',
          // Keeps the tap target at the 44pt minimum without visually
          // crowding the primary action above it.
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginTop: 4,
        },
        forgotText: { ...typography.caption, color: colors.textSecondary },
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
      await login(identifier, password);
    } catch (error: any) {
      showAlert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = identifier.trim();
    if (!email.includes('@')) {
      showToast('Enter your email address first', 'error');
      setStep(0);
      return;
    }
    try {
      await forgotPassword(email);
      showAlert(
        'Check your email',
        'If an account exists for that address, a password reset link is on its way.'
      );
    } catch (error: any) {
      showAlert('Could not send reset email', error.message || 'Please try again.');
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

  return (
    <Animated.View style={[styles.container, { opacity: backdropAnim }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingTop: 18,
              paddingBottom: insets.bottom + 10,
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (step > 0 ? setStep(0) : navigation.goBack())}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.dotRow}>
              <View style={[styles.dot, step === 0 && styles.dotActive]} />
              <View style={[styles.dot, step === 1 && styles.dotActive]} />
            </View>
          </View>

          <Text style={styles.intro}>Welcome back</Text>
          <Text style={styles.title}>{step === 0 ? 'Enter your email' : 'Enter your password'}</Text>

          <View style={styles.fieldWrap}>
            {step === 0 ? (
              <TextInput
                style={styles.input}
                placeholder="your@email.com or @handle"
                placeholderTextColor={colors.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
            ) : (
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  keyboardAppearance="dark"
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
              style={[
                styles.actionButton,
                canProceed && !loading && styles.actionEnabled,
              ]}
              onPress={handleNext}
              disabled={loading}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={step === 0 ? 'Continue to password' : 'Log in'}
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color={colors.interactiveText} />
              ) : (
                <Text style={[styles.actionText, canProceed && styles.actionTextEnabled]}>
                  {step === 0 ? 'Next' : 'Log in'}
                </Text>
              )}
            </TouchableOpacity>

            {step === 1 && (
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotButton}
                accessibilityRole="button"
                accessibilityLabel="Reset your password by email"
              >
                <Text style={styles.forgotText}>Forgot your password?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
