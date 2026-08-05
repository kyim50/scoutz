import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * The three non-happy states a data-driven view can be in.
 *
 * Before this existed, a failed request showed a toast and left an empty list,
 * which is indistinguishable from "there is genuinely nothing here" — the user
 * had no way to tell the difference and no way to retry. Error states now
 * always offer a retry; empty states always offer the action that fills them.
 */

interface ErrorStateProps {
  /** What the user was trying to see, e.g. "saved places". */
  subject?: string;
  onRetry?: () => void;
  /** Set when the failure looks like a connectivity problem. */
  offline?: boolean;
}

export function ErrorState({ subject = 'this', onRetry, offline }: ErrorStateProps) {
  const { colors } = useTheme();
  const s = useStyles();

  return (
    <View style={s.wrap} accessibilityRole="alert">
      <View style={[s.iconCircle, { backgroundColor: colors.errorTint }]}>
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={26}
          color={colors.error}
        />
      </View>

      <Text style={s.title}>
        {offline ? "Can't reach the server" : `Couldn't load ${subject}`}
      </Text>
      <Text style={s.body}>
        {offline
          ? 'Check your connection and try again.'
          : 'Something went wrong on our end. Give it another try.'}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={s.button}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={`Retry loading ${subject}`}
        >
          <Ionicons name="refresh" size={16} color={colors.interactiveText} />
          <Text style={s.buttonText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Say what the user can do about it, not just that there's nothing here. */
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'map-outline', title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  const s = useStyles();

  return (
    <View style={s.wrap}>
      <View style={[s.iconCircle, { backgroundColor: colors.accentTint }]}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>

      <Text style={s.title}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}

      {actionLabel && onAction && (
        <TouchableOpacity
          style={s.button}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { colors } = useTheme();
  const s = useStyles();

  return (
    <View style={s.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        },
        iconCircle: {
          width: 56,
          height: 56,
          borderRadius: borderRadius.round,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        },
        title: {
          ...typography.bodySemibold,
          color: colors.text,
          textAlign: 'center',
        },
        body: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          textAlign: 'center',
          maxWidth: 280,
        },
        button: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.sm,
          backgroundColor: colors.interactiveBg,
          paddingHorizontal: spacing.lg,
          // 44pt minimum touch target.
          minHeight: 44,
          justifyContent: 'center',
          borderRadius: borderRadius.round,
        },
        buttonText: {
          ...typography.buttonSmall,
          color: colors.interactiveText,
        },
      }),
    [colors]
  );
}
