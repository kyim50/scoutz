import { Platform } from 'react-native';

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  accentTint: string;
  accentTint30: string;
  background: string;
  backgroundGray: string;
  surface: string;
  surfaceGray: string;
  surfaceHigh: string;
  dark: string;
  interactiveBg: string;
  interactiveText: string;
  darkGray: string;
  mediumGray: string;
  lightGray: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  pinActive: string;
  pinEvent: string;
  pinVerified: string;
  white: string;
  black: string;
  transparent: string;
  overlay: string;
  overlayLight: string;
  border: string;
  borderLight: string;
  borderDark: string;
  glass: string;
  glassBorder: string;
  /** Elevated card surface, sitting above `background`. */
  card: string;
  /** Fill for text inputs and inactive segmented controls. */
  inputBg: string;
  /** Low-opacity error wash for destructive rows and banners. */
  errorTint: string;
};

export const lightColors: ThemeColors = {
  primary: '#1E9458',
  primaryDark: '#1A7A4A',
  primaryLight: '#28B873',
  accent: '#28B873',
  accentLight: '#3DDC91',
  accentDark: '#1E9458',
  accentTint: 'rgba(40, 184, 115, 0.09)',
  accentTint30: 'rgba(40, 184, 115, 0.20)',
  // Elevation ramp. These were all #FFFFFF, so light mode had no depth at all
  // and every surface distinction relied on shadow alone. Dark mode already had
  // a proper three-step ramp; this gives light mode the same structure.
  background: '#F7F8F7',
  backgroundGray: '#EFF1EF',
  surface: '#FFFFFF',
  surfaceGray: '#F2F4F2',
  surfaceHigh: '#FFFFFF',
  interactiveBg: '#28B873',
  interactiveText: '#FFFFFF',
  dark: '#000000',
  darkGray: '#3A3A3C',
  mediumGray: '#6C6C70',
  lightGray: '#E5E5EA',
  text: '#000000',
  textSecondary: '#6C6C70',
  textMuted: '#C7C7CC',
  textLight: '#FFFFFF',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#28B873',
  pinActive: '#28B873',
  pinEvent: '#28B873',
  pinVerified: '#34C759',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  border: '#E5E5EA',
  borderLight: '#F2F2F7',
  borderDark: '#C7C7CC',
  glass: 'rgba(255, 255, 255, 0.70)',
  glassBorder: 'rgba(0, 0, 0, 0.06)',
  card: '#FFFFFF',
  inputBg: '#F2F2F7',
  errorTint: 'rgba(255, 59, 48, 0.10)',
};

export const darkColors: ThemeColors = {
  primary: '#FFFFFF',
  primaryDark: '#E5E5E5',
  primaryLight: '#F0F0F0',
  accent: '#3DDC91',
  accentLight: '#6FE8AD',
  accentDark: '#28B873',
  accentTint: 'rgba(61, 220, 145, 0.09)',
  accentTint30: 'rgba(61, 220, 145, 0.30)',
  background: '#000000',
  backgroundGray: '#0A0A0A',
  surface: '#141414',
  surfaceGray: '#1C1C1E',
  surfaceHigh: '#242424',
  dark: '#FFFFFF',
  interactiveBg: '#FFFFFF',
  interactiveText: '#000000',
  darkGray: '#C7C7CC',
  mediumGray: '#8E8E93',
  lightGray: '#3A3A3C',
  text: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#636366',
  textLight: '#FFFFFF',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#3DDC91',
  pinActive: '#FFFFFF',
  pinEvent: '#3DDC91',
  pinVerified: '#30D158',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  border: '#1C1C1E',
  borderLight: '#1A1A1A',
  borderDark: '#48484A',
  glass: 'rgba(28, 28, 30, 0.65)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  card: '#141414',
  inputBg: '#1C1C1E',
  errorTint: 'rgba(255, 69, 58, 0.15)',
};

/** @deprecated Import via `useTheme()` instead — this is always light-mode values. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 2,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  round: 9999,
};

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const typography = {
  displayLarge: {
    fontSize: 48,
    fontWeight: '700' as const,
    lineHeight: 56,
  },
  displayMedium: {
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 48,
  },

  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },

  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  bodySemibold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
  },

  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmallMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  bodySmallSemibold: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },

  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },

  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  captionMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },

  mono: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    fontFamily: monoFamily,
  },
  monoSmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    fontFamily: monoFamily,
  },
  monoMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    fontFamily: monoFamily,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 10,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 16,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  mintGlow: {
    shadowColor: '#28B873',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
};

export default {
  colors: lightColors,
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
};
