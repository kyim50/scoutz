import { Easing } from 'react-native';

/**
 * Shared motion tokens.
 *
 * Both auth sheets previously animated in with a spring and out with a linear
 * timing, using React Native's default easing — which is ease-in-out, so an
 * entering sheet started slow at exactly the moment the user is watching most
 * closely. That reads as sluggish and jagged. These tokens give every sheet the
 * same character.
 */

/**
 * iOS drawer curve. Strong ease-out with no overshoot — the element moves
 * immediately on press and settles rather than bouncing.
 */
export const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

/** Enter is deliberate; exit is snappier, because the user has already decided. */
export const SHEET_IN_MS = 340;
export const SHEET_OUT_MS = 220;

/**
 * The keyboard animates on its own curve and duration, which iOS reports on the
 * event. Matching it makes the sheet travel locked to the keyboard instead of
 * racing it. These are only fallbacks for when the platform reports nothing.
 */
export const KEYBOARD_FALLBACK_MS = 250;
export const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.4, 0.77);

/** Distance the sheet travels when entering or leaving. */
export const SHEET_TRAVEL = 80;
