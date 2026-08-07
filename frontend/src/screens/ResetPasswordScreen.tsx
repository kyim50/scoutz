import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated from 'react-native-reanimated';
import { useSheetModal } from '../hooks/useSheetModal';
import { spacing, borderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const MIN_LENGTH = 8;

/**
 * Shown when a recovery link has established a session but no new password has
 * been set. The navigator renders this ahead of both stacks, because a recovery
 * session is a real session and the user would otherwise land in the app
 * without ever choosing a password.
 *
 * Deliberately built from the same pieces as the login and signup sheets —
 * same container, type scale, inputs, and entry motion via useSheetModal. This
 * is the last screen of the reset flow the user started in those sheets, so it
 * arriving as a differently-styled full-screen page reads as a different app.
 */
export default function ResetPasswordScreen() {
  const { completePasswordReset, cancelPasswordRecovery } = useAuth();
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Not presented in a Modal, but reusing the hook keeps the entry and keyboard
  // behaviour identical to the sheets this flow began in.
  const { sheetStyle, onSheetLayout, animateIn, close } = useSheetModal({
    visible: true,
    onClose: () => void cancelPasswordRecovery(),
  });

  useEffect(() => {
    animateIn();
    passwordRef.current?.focus();
  }, [animateIn]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !saving;

  const hint = mismatch
    ? { text: "Those don't match yet.", tone: 'bad' as const }
    : tooShort
      ? { text: `At least ${MIN_LENGTH} characters.`, tone: 'bad' as const }
      : password.length >= MIN_LENGTH && confirm.length === 0
        ? { text: 'Now confirm it below.', tone: 'neutral' as const }
        : canSubmit
          ? { text: 'Looks good.', tone: 'good' as const }
          : { text: `Use at least ${MIN_LENGTH} characters.`, tone: 'neutral' as const };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: colors.surface },
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
          letterSpacing: -0.9,
          lineHeight: 38,
          marginBottom: spacing.md,
          maxWidth: 320,
        },
        fieldWrap: { marginBottom: spacing.sm, gap: spacing.sm },
        passwordWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.borderDark,
        },
        passwordWrapError: { borderColor: colors.error },
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
        hintRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.xs,
          // Reserved so the layout doesn't jump as the hint changes.
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
        actionText: {
          fontSize: 17,
          color: colors.textMuted,
          fontWeight: '600',
          letterSpacing: -0.2,
        },
        actionTextEnabled: { color: colors.interactiveText },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: spacing.md,
          minHeight: 44,
        },
        footerText: { fontSize: 13, color: colors.textSecondary },
      }),
    [colors]
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await completePasswordReset(password);
      showToast('Password updated. You are signed in.', 'success');
    } catch (error: any) {
      showAlert('Could not update password', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    showAlert('Discard password reset?', 'You will need a new link to try again.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => close() },
    ]);
  };

  const hintColor =
    hint.tone === 'good' ? colors.success : hint.tone === 'bad' ? colors.error : colors.textMuted;

  return (
    <View style={styles.backdrop}>
      <Reanimated.View
        style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, sheetStyle]}
      >
        <View
          onLayout={onSheetLayout}
          style={[styles.sheet, { paddingTop: 18, paddingBottom: insets.bottom + 10 }]}
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel password reset"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.intro}>Reset password</Text>
          <Text style={styles.title}>Choose a new password</Text>

          <View style={styles.fieldWrap}>
            <View style={[styles.passwordWrap, tooShort && styles.passwordWrapError]}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                placeholder="New password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                accessibilityLabel="New password"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={visible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.passwordWrap, mismatch && styles.passwordWrapError]}>
              <TextInput
                ref={confirmRef}
                style={styles.passwordInput}
                placeholder="Confirm password"
                placeholderTextColor={colors.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel="Confirm new password"
              />
            </View>

            <View style={styles.hintRow}>
              <Ionicons
                name={
                  hint.tone === 'good'
                    ? 'checkmark-circle'
                    : hint.tone === 'bad'
                      ? 'close-circle'
                      : 'information-circle-outline'
                }
                size={15}
                color={hintColor}
              />
              <Text style={[styles.hintText, { color: hintColor }]}>{hint.text}</Text>
            </View>
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={[styles.actionButton, canSubmit && styles.actionEnabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Save new password"
              accessibilityState={{ disabled: !canSubmit }}
            >
              {saving ? (
                <ActivityIndicator color={colors.interactiveText} />
              ) : (
                <Text style={[styles.actionText, canSubmit && styles.actionTextEnabled]}>
                  Save password
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                You&apos;ll be signed in as soon as this is saved.
              </Text>
            </View>
          </View>
        </View>
      </Reanimated.View>
    </View>
  );
}
