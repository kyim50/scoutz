import React, { createContext, useState, useCallback, useContext, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';
import { spacing, borderRadius, typography } from '../constants/theme';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type ToastType = 'success' | 'error' | 'info' | 'default';

interface ToastState {
  message: string;
  type: ToastType;
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  showToast: (message: string, type?: ToastType) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const TOAST_DURATION = 3000;

function ThemedAlertModal({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.lg * 2, 340);

  const handlePress = (button: AlertButton) => {
    button.onPress?.();
    onDismiss();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 24,
        },
        android: { elevation: 12 },
      }),
    },
    title: {
      ...typography.h5,
      color: colors.text,
      marginBottom: message ? spacing.sm : spacing.lg,
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    button: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minWidth: 72,
      alignItems: 'center',
    },
    buttonTextCancel: {
      ...typography.buttonSmall,
      color: colors.textSecondary,
    },
    buttonTextDefault: {
      ...typography.buttonSmall,
      color: colors.primary,
    },
    buttonTextDestructive: {
      ...typography.buttonSmall,
      color: colors.error,
    },
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttonRow}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={styles.button}
                onPress={() => handlePress(btn)}
                activeOpacity={0.8}
              >
                <Text
                  style={
                    btn.style === 'cancel'
                      ? styles.buttonTextCancel
                      : btn.style === 'destructive'
                        ? styles.buttonTextDestructive
                        : styles.buttonTextDefault
                  }
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ThemedToast({ message, type, onHide }: { message: string; type: ToastType; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }, TOAST_DURATION);
    return () => clearTimeout(t);
  }, []);

  const bgByType =
    type === 'success'
      ? colors.success
      : type === 'error'
        ? colors.error
        : type === 'info'
          ? colors.info
          : colors.surface;
  const textColor = type === 'default' ? colors.text : colors.white;

  const styles = StyleSheet.create({
    wrapper: {
      position: 'absolute',
      top: 0,
      left: spacing.lg,
      right: spacing.lg,
      paddingTop: insets.top + spacing.sm,
      alignItems: 'center',
      zIndex: 9999,
    },
    toast: {
      backgroundColor: bgByType,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.lg,
      maxWidth: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: { elevation: 8 },
      }),
    },
    message: {
      ...typography.bodySmallSemibold,
      color: textColor,
    },
  });

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    const defaultButtons: AlertButton[] = [{ text: 'OK', onPress: () => {} }];
    setAlert({
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : defaultButtons,
    });
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'default') => {
    setToast({ message, type });
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const api = React.useMemo(() => ({ showAlert, showToast }), [showAlert, showToast]);
  React.useEffect(() => {
    alertApiRef = api;
    return () => {
      alertApiRef = null;
    };
  }, [api]);

  return (
    <AlertContext.Provider value={{ showAlert, showToast }}>
      {children}
      <ThemedAlertModal
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons ?? []}
        onDismiss={dismissAlert}
      />
      {toast && (
        <ThemedToast message={toast.message} type={toast.type} onHide={dismissToast} />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (ctx === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return ctx;
}

// Imperative API for use outside React (e.g. utils/sharing.ts)
let alertApiRef: AlertContextType | null = null;

export function getAlertApi(): AlertContextType | null {
  return alertApiRef;
}
