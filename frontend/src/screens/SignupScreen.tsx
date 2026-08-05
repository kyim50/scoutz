import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';

interface SignupScreenProps {
  navigation: any;
}

export default function SignupScreen({ navigation }: SignupScreenProps) {
  const { showAlert, showToast } = useAlert();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signup } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        keyboardView: { flex: 1 },
        content: {
          flex: 1,
          paddingHorizontal: spacing.md,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.lg,
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
        title: {
          ...typography.h1,
          color: colors.text,
          letterSpacing: -0.6,
          marginBottom: spacing.sm,
        },
        fieldWrap: {
          marginBottom: spacing.sm,
        },
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
          lineHeight: 22,
          textAlignVertical: 'center',
        },
        eyeIcon: { paddingHorizontal: spacing.md },
        helperText: {
          marginTop: spacing.xs,
          color: colors.textMuted,
          fontSize: 12,
        },
        bottom: {
          marginTop: 'auto',
          paddingBottom: spacing.sm,
        },
        nextButton: {
          height: 52,
          backgroundColor: colors.borderDark,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        nextButtonEnabled: {
          backgroundColor: colors.interactiveBg,
        },
        nextButtonText: { ...typography.h4, color: colors.textMuted },
        nextButtonTextEnabled: { color: colors.interactiveText },
        termsText: {
          ...typography.caption,
          marginTop: spacing.sm,
          color: colors.textMuted,
          textAlign: 'center',
        },
        termsLink: { color: colors.textSecondary, fontWeight: '600' },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.md,
        },
        footerText: { ...typography.caption, color: colors.textSecondary },
        loginLink: { ...typography.captionBold, color: colors.text },
      }),
    [colors]
  );

  const handleSignup = async () => {
    if (!name || !username || !email || !password) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    if (username.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      const { requiresEmailConfirmation } = await signup(email, password, name, username);
      if (requiresEmailConfirmation) {
        // No session yet — the user has to confirm before they can sign in.
        showAlert(
          'Confirm your email',
          `We sent a confirmation link to ${email.trim()}. Tap it, then log in.`
        );
        navigation.navigate('Login');
      }
    } catch (error: any) {
      showAlert('Signup Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      key: 'email',
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
      valid: username.trim().length >= 3,
    },
    {
      key: 'password',
      title: 'Create a password',
      placeholder: 'At least 8 characters',
      value: password,
      onChange: setPassword,
      keyboardType: 'default' as const,
      autoCapitalize: 'none' as const,
      secure: true,
      valid: password.length >= 8,
    },
  ];

  const currentStep = steps[step];

  const handleNext = async () => {
    if (!currentStep.valid) {
      if (currentStep.key === 'email') showToast('Please enter a valid email', 'error');
      else if (currentStep.key === 'username') showToast('Username must be at least 3 characters', 'error');
      else if (currentStep.key === 'password') showToast('Password must be at least 8 characters', 'error');
      else showToast('Please fill in this field', 'error');
      return;
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    await handleSignup();
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.background, colors.surface]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (step > 0 ? setStep(step - 1) : navigation.navigate('Welcome'))}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.dotRow}>
                {steps.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx <= step && styles.dotActive]} />
                ))}
              </View>
            </View>

            <Text style={styles.title}>{currentStep.title}</Text>

            <View style={styles.fieldWrap}>
              {currentStep.secure ? (
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={currentStep.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={currentStep.value}
                    onChangeText={currentStep.onChange}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    autoCapitalize={currentStep.autoCapitalize}
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
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder={currentStep.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={currentStep.value}
                  onChangeText={currentStep.onChange}
                  autoCapitalize={currentStep.autoCapitalize}
                  autoCorrect={false}
                  keyboardType={currentStep.keyboardType}
                  keyboardAppearance="dark"
                />
              )}
              {currentStep.key === 'password' && password.length > 0 && password.length < 8 && (
                <Text style={styles.helperText}>
                  {8 - password.length} more characters needed
                </Text>
              )}
            </View>

            <View style={styles.bottom}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  currentStep.valid && !loading && styles.nextButtonEnabled,
                ]}
                onPress={handleNext}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={colors.interactiveText} />
                ) : (
                  <Text style={[styles.nextButtonText, currentStep.valid && styles.nextButtonTextEnabled]}>
                    {step === steps.length - 1 ? 'Create account' : 'Next'}
                  </Text>
                )}
              </TouchableOpacity>

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
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
