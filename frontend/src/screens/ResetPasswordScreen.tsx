import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const MIN_LENGTH = 8;

/**
 * Shown when a recovery deep link has established a session but no new password
 * has been set yet. The navigator renders this ahead of everything else, since
 * the recovery session is a real session and the user would otherwise land in
 * the app without ever choosing a password.
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

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !saving;

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.xl,
          gap: spacing.md,
        },
        iconCircle: {
          width: 56,
          height: 56,
          borderRadius: borderRadius.round,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        },
        title: { ...typography.h2, color: colors.text },
        subtitle: { ...typography.bodySmall, color: colors.textSecondary, maxWidth: 340 },
        field: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBg,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          minHeight: 52,
          borderWidth: 1,
          borderColor: colors.border,
        },
        fieldError: { borderColor: colors.error },
        input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
        eye: { padding: spacing.sm, marginRight: -spacing.sm },
        hint: { ...typography.caption, color: colors.textSecondary },
        hintError: { ...typography.caption, color: colors.error },
        bottom: { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, gap: spacing.sm },
        button: {
          minHeight: 52,
          borderRadius: borderRadius.round,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceGray,
        },
        buttonEnabled: { backgroundColor: colors.interactiveBg },
        buttonText: { ...typography.button, color: colors.textMuted },
        buttonTextEnabled: { color: colors.interactiveText },
        cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
        cancelText: { ...typography.caption, color: colors.textSecondary },
      }),
    [colors, insets]
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
      { text: 'Discard', style: 'destructive', onPress: () => void cancelPasswordRecovery() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="key-outline" size={26} color={colors.accent} />
        </View>

        <Text style={s.title}>Choose a new password</Text>
        <Text style={s.subtitle}>
          Your link checked out. Set a password and you&apos;ll be signed straight in.
        </Text>

        <View style={[s.field, tooShort && s.fieldError]}>
          <TextInput
            style={s.input}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="New password"
          />
          <TouchableOpacity
            style={s.eye}
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

        <View style={[s.field, mismatch && s.fieldError]}>
          <TextInput
            style={s.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            accessibilityLabel="Confirm new password"
          />
        </View>

        <Text style={mismatch || tooShort ? s.hintError : s.hint}>
          {mismatch
            ? "Those don't match yet."
            : tooShort
              ? `At least ${MIN_LENGTH} characters.`
              : `Use at least ${MIN_LENGTH} characters.`}
        </Text>
      </View>

      <View style={s.bottom}>
        <TouchableOpacity
          style={[s.button, canSubmit && s.buttonEnabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {saving ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <Text style={[s.buttonText, canSubmit && s.buttonTextEnabled]}>Save password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.cancel}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel password reset"
        >
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
