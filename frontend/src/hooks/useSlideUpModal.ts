import { useRef, useCallback } from 'react';
import { Keyboard, Platform, Dimensions } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { SHEET_EASING, SHEET_IN_MS, SHEET_OUT_MS } from '../lib/motion';

interface Options {
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * Full-screen modal that slides up from the bottom.
 *
 * This replaced a bottom sheet, and the reason is worth keeping: a sheet is
 * content-sized and anchored to the bottom, so every keyboard change moves the
 * entire surface. That has to be kept in step with the system keyboard frame by
 * frame, and any disagreement shows up as stutter, or as the keyboard appearing
 * to arrive before the sheet. Several attempts at syncing them all failed in
 * different ways.
 *
 * Full screen removes the negotiation rather than solving it. The container
 * covers the window and does not move when the keyboard appears, so there is
 * nothing to synchronise and nothing for the keyboard to rise in front of. Only
 * a spacer at the bottom of the content reacts, lifting the action button clear
 * of the keyboard — a small, local adjustment instead of moving everything.
 */
export function useSlideUpModal({ onClose }: Options) {
  const keyboard = useAnimatedKeyboard();

  /** Downward offset in px. 0 is fully presented, SCREEN_HEIGHT is off screen. */
  const offset = useSharedValue(SCREEN_HEIGHT);
  const afterCloseRef = useRef<(() => void) | null>(null);

  /** The whole surface. Deliberately independent of the keyboard. */
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  /**
   * Sits at the bottom of the content and grows to the keyboard's height,
   * pushing the action button above it. Driven from the real keyboard value on
   * the UI thread, so it tracks exactly.
   */
  const keyboardSpacerStyle = useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }));

  const animateIn = useCallback(() => {
    offset.value = SCREEN_HEIGHT;
    offset.value = withTiming(0, { duration: SHEET_IN_MS, easing: SHEET_EASING });
  }, [offset]);

  /**
   * Run queued work once the modal has actually gone. Presenting another native
   * modal while this one is dismissing leaves an invisible modal on screen
   * swallowing touches, which looks like the app has frozen.
   */
  const runAfterClose = useCallback(() => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    fn?.();
  }, []);

  const finishClose = useCallback(() => {
    onClose();
    // iOS reports real dismissal through Modal.onDismiss, the only safe moment
    // to present anything else. Android has no equivalent.
    if (Platform.OS !== 'ios') runAfterClose();
  }, [onClose, runAfterClose]);

  const close = useCallback(
    (after?: () => void) => {
      // Guarded because this doubles as an onPress handler, which would
      // otherwise hand us a touch event to "call" after dismissal.
      afterCloseRef.current = typeof after === 'function' ? after : null;
      Keyboard.dismiss();

      offset.value = withTiming(
        SCREEN_HEIGHT,
        { duration: SHEET_OUT_MS, easing: SHEET_EASING },
        (finished) => {
          'worklet';
          if (finished) runOnJS(finishClose)();
        }
      );
    },
    [offset, finishClose]
  );

  return {
    containerStyle,
    keyboardSpacerStyle,
    animateIn,
    close,
    runAfterClose,
  };
}
