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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { useSheetModal } from '../hooks/useSheetModal';
import { spacing, borderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';

/** Taller than any keyboard, so the sheet never reveals a gap beneath it. */
const SHEET_TAIL_HEIGHT = 600;

interface SignupModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function SignupModal({ visible, onClose, onSwitchToLogin }: SignupModalProps) {
  const { showAlert, showToast } = useAlert();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();
  const { signup } = useAuth();
  const usernameCheck = useUsernameAvailability(username);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    backdropOpacity,
    sheetTranslateY,
    animateIn,
    close: animateAndClose,
    runAfterClose,
  } = useSheetModal({ visible, onClose });

  const emailInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputRefs = [emailInputRef, nameInputRef, usernameInputRef, passwordInputRef];

  useEffect(() => {
    if (visible) {
      setStep(0);
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
    } else {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step > 0) {
      const t = setTimeout(() => inputRefs[step]?.current?.focus(), 100);
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
          fontWeight: '400',
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
          fontWeight: '400',
        },
        eyeIcon: { paddingHorizontal: spacing.md },
        helperText: {
          marginTop: spacing.xs,
          color: colors.textMuted,
          fontSize: 12,
        },
        hintRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.xs,
          // Reserved so the layout doesn't jump as the hint appears and changes.
          minHeight: 18,
        },
        hintText: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
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
        termsText: {
          marginTop: spacing.xs + 2,
          fontSize: 12,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 16,
        },
        termsLink: { color: colors.textSecondary, fontWeight: '600' },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.md,
        },
        footerText: { fontSize: 13, color: colors.textSecondary },
        loginLink: { fontSize: 13, color: colors.text, fontWeight: '700' },
      }),
    [colors]
  );

  const steps = [
    {
      key: 'email',
      intro: 'Create your account',
      title: "What's your email?",
      placeholder: 'Enter your email address',
      value: email,
      onChange: setEmail,
      keyboardType: 'email-address' as const,
      autoCapitalize: 'none' as const,
      secure: false,
      valid: /\S+@\S+\.\S+/.test(email.trim()),
    },
    {
      key: 'name',
      intro: 'Nice to meet you',
      title: "What's your name?",
      placeholder: 'Enter your full name',
      value: name,
      onChange: setName,
      keyboardType: 'default' as const,
      autoCapitalize: 'words' as const,
      secure: false,
      valid: name.trim().length >= 2,
    },
    {
      key: 'username',
      intro: 'Almost there',
      title: 'Choose a username',
      placeholder: '@yourhandle',
      value: username ? `@${username}` : '',
      onChange: (t: string) => {
        const stripped = t.startsWith('@') ? t.slice(1) : t;
        setUsername(stripped.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
      },
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      secure: false,
      // Availability is checked live, so a taken name can no longer pass this
      // step and fail at submit after everything else has been entered.
      valid: usernameCheck.canProceed,
      hint: usernameCheck.message,
      hintTone:
        usernameCheck.status === 'available'
          ? ('good' as const)
          : usernameCheck.status === 'taken' || usernameCheck.status === 'invalid'
            ? ('bad' as const)
            : ('neutral' as const),
    },
    {
      key: 'password',
      intro: 'Create a password',
      title: 'Choose a password',
      placeholder: 'At least 8 characters',
      value: password,
      onChange: setPassword,
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      secure: true,
      valid: password.length >= 8,
    },
  ];

  const currentStep = (step < steps.length ? steps[step] : null) as
    | (typeof steps)[number] & { hint?: string | null; hintTone?: 'good' | 'bad' | 'neutral' }
    | null;

  const handleSignup = async () => {
    if (!email.trim() || !name.trim() || !username.trim() || password.length < 8) {
      showToast('Please fill in all fields (password at least 8 characters)', 'error');
      return;
    }
    setLoading(true);
    try {
      const { requiresEmailConfirmation } = await signup(
        email.trim(),
        password,
        name.trim(),
        username.trim()
      );

      const address = email.trim();
      // Queued rather than shown inline — see animateAndClose.
      animateAndClose(
        requiresEmailConfirmation
          ? () =>
              showAlert(
                'Confirm your email',
                `We sent a link to ${address}. Tap it to activate your account, then come back and log in.`
              )
          : undefined
      );
    } catch (error: any) {
      showAlert('Signup Failed', error?.message ?? 'Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!currentStep?.valid) {
      if (currentStep?.key === 'username') {
        // Say which of the several username problems it actually is.
        showToast(usernameCheck.message ?? 'Pick a username', 'error');
      } else if (currentStep?.key === 'email') {
        showToast('Please enter a valid email', 'error');
      } else if (currentStep?.key === 'name') {
        showToast('Please enter your name', 'error');
      } else if (currentStep?.key === 'password') {
        showToast('Password must be at least 8 characters', 'error');
      } else {
        showToast('Please fill in this field', 'error');
      }
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    await handleSignup();
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      animateAndClose();
    }
  };

  const handleShow = () => {
    animateIn();
    focusTimeoutRef.current = setTimeout(() => {
      emailInputRef.current?.focus();
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
        {/* Dim overlay — pointer-events none so touches pass through */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropOpacity },
          ]}
        />

        {/* Flexible dismiss area above the sheet */}
        <Pressable style={{ flex: 1 }} onPress={() => animateAndClose()} />

        {/* Anchored to the bottom and moved entirely by transform: the entry
            offset and the keyboard height are composed into one translateY, so
            both run on the native driver instead of re-laying-out the sheet.
            The tail below fills the area the keyboard vacates, which avoids
            animating `height` on every keyboard frame. */}
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
                {steps.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx <= step && styles.dotActive]} />
                ))}
              </View>
            </View>

            <Text style={styles.intro}>{currentStep?.intro}</Text>
            <Text style={styles.title}>{currentStep?.title}</Text>

            <View style={styles.fieldWrap}>
              {currentStep?.key === 'password' ? (
                <View style={styles.passwordWrap}>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.passwordInput}
                    placeholder={currentStep.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
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
              ) : currentStep && (
                <TextInput
                  ref={
                    currentStep.key === 'email'
                      ? emailInputRef
                      : currentStep.key === 'name'
                        ? nameInputRef
                        : usernameInputRef
                  }
                  style={styles.input}
                  placeholder={currentStep.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={currentStep.value}
                  onChangeText={currentStep.onChange}
                  autoCapitalize={currentStep.autoCapitalize}
                  autoCorrect={false}
                  keyboardType={currentStep.keyboardType}
                  secureTextEntry={currentStep.secure}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                />
              )}

              {/* Live feedback so a problem is visible on the step that caused
                  it, rather than surfacing as a failure at submit. */}
              {currentStep?.hint ? (
                <View style={styles.hintRow}>
                  {currentStep.hintTone === 'neutral' && usernameCheck.status === 'checking' ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <Ionicons
                      name={
                        currentStep.hintTone === 'good'
                          ? 'checkmark-circle'
                          : currentStep.hintTone === 'bad'
                            ? 'close-circle'
                            : 'information-circle-outline'
                      }
                      size={15}
                      color={
                        currentStep.hintTone === 'good'
                          ? colors.success
                          : currentStep.hintTone === 'bad'
                            ? colors.error
                            : colors.textMuted
                      }
                    />
                  )}
                  <Text
                    style={[
                      styles.hintText,
                      currentStep.hintTone === 'good' && { color: colors.success },
                      currentStep.hintTone === 'bad' && { color: colors.error },
                    ]}
                  >
                    {currentStep.hint}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bottom}>
              <TouchableOpacity
                style={[styles.actionButton, currentStep?.valid && !loading && styles.actionEnabled]}
                onPress={handleNext}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={colors.interactiveText} />
                ) : (
                  <Text style={[styles.actionText, currentStep?.valid && styles.actionTextEnabled]}>
                    {step === steps.length - 1 ? 'Create account' : 'Next'}
                  </Text>
                )}
              </TouchableOpacity>

              {step === steps.length - 1 && (
                <Text style={styles.termsText}>
                  By signing up, you agree to our{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('TermsOfService')}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={onSwitchToLogin}>
                  <Text style={styles.loginLink}>Log in</Text>
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
        </Animated.View>
      </View>
    </Modal>
  );
}
