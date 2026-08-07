import { Easing } from 'react-native-reanimated';

/**
 * Shared motion tokens.
 *
 * Easing comes from Reanimated rather than react-native, because these curves
 * are consumed inside worklets running on the UI thread.
 *
 * The auth sheets originally animated in with a spring and out with a timing,
 * and neither passed an easing — so both fell back to ease-in-out, which starts
 * slow at exactly the moment the user is watching most closely. These tokens
 * give every sheet the same character.
 */

/**
 * iOS drawer curve. Strong ease-out with no overshoot: the sheet moves
 * immediately and settles rather than bouncing.
 */
export const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

/** Enter is deliberate; exit is snappier, because the user has already decided. */
export const SHEET_IN_MS = 340;
export const SHEET_OUT_MS = 220;

/**
 * How far the sheet rises on entry. Deliberately short — the keyboard supplies
 * most of the upward movement, and entering from the sheet's full height meant
 * crossing that plus the keyboard's inside one keyboard duration, which lurches.
 * Exit is separate and travels the measured height so the sheet clears the
 * screen before the backdrop finishes.
 */
export const SHEET_TRAVEL = 80;
