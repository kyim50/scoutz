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
 * Matched to the iOS keyboard, which shows and hides in 250ms.
 *
 * This is the important number. The sheet and the keyboard rise together, so if
 * the sheet runs longer it is still travelling after the keyboard has stopped —
 * and because the curve is a strong ease-out, that remainder is a slow creep
 * over the final few pixels. It reads as the keyboard arriving first and the
 * sheet catching up behind it, which is exactly the two-stage entry this was
 * meant to remove. Landing together is what makes it one movement.
 */
export const SHEET_IN_MS = 250;
export const SHEET_OUT_MS = 220;

