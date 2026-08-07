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

/**
 * Enter is deliberate; exit is snappier, because the user has already decided.
 *
 * Entry covers the sheet's height plus the keyboard's, since both rise at once,
 * so it is pitched slightly longer than a bare slide would need.
 */
export const SHEET_IN_MS = 400;
export const SHEET_OUT_MS = 240;

