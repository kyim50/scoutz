import { useRef, useCallback } from 'react';
import { Keyboard, Platform, LayoutChangeEvent, Dimensions } from 'react-native';
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

/** Used until the sheet has been measured; always clears the screen. */
const FALLBACK_HEIGHT = Dimensions.get('window').height;

/**
 * Enter/exit and keyboard motion for a bottom sheet presented in a Modal.
 *
 * Built on Reanimated's `useAnimatedKeyboard`, which reports keyboard height as
 * a UI-thread shared value driven by the real keyboard.
 *
 * The previous version listened for keyboardWillShow and ran its own timing to
 * reproduce the same movement. An approximation on the JS thread can never
 * track the system's animation exactly, and the drift between the two is what
 * showed up as stutter — no amount of curve or duration matching fixes that,
 * because there are still two animations disagreeing. Reading the real value
 * removes the second animation entirely.
 *
 * Everything here runs on the UI thread, so it also stays smooth while JS is
 * busy — which matters, since the username availability check fires while the
 * sheet is on screen.
 *
 * Both directions travel the sheet's measured height. Exit needs it so the
 * sheet is gone before the backdrop finishes — a short slide followed by the
 * backdrop cutting out leaves it visible as everything disappears, which reads
 * as a flash. Entry needs it so the sheet is genuinely off screen when the
 * modal window presents, rather than sitting at the bottom waiting for the
 * keyboard to rise over it.
 */
export function useSheetModal({ onClose }: Options) {
  const keyboard = useAnimatedKeyboard();

  /**
   * Downward offset in px. 0 is fully presented.
   *
   * Starts a full screen below rather than a short hop, because the modal
   * window presents before onShow fires. Resting close to the final position
   * meant the sheet was already on screen at that moment, so the keyboard rose
   * over the top of it and the sheet then reappeared above — which looks like
   * the keyboard arriving first and the sheet catching up behind it.
   */
  const offset = useSharedValue(FALLBACK_HEIGHT);
  const backdrop = useSharedValue(0);

  const heightRef = useRef(FALLBACK_HEIGHT);
  const afterCloseRef = useRef<(() => void) | null>(null);

  /** Measures the sheet so exit travels far enough to clear the screen. */
  const onSheetLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) heightRef.current = h;
  }, []);

  /**
   * One transform for both movements. `keyboard.height` is the live keyboard
   * position, so the sheet is glued to it rather than chasing a copy.
   */
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value - keyboard.height.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const animateIn = useCallback(() => {
    // Snap off screen, then rise. The keyboard is coming up at the same time
    // and adds its own height to the travel, so the sheet's duration is set a
    // little longer than a bare slide would need — the combined distance is the
    // sheet's height plus the keyboard's, and rushing that is what made an
    // earlier version lurch.
    offset.value = heightRef.current;
    backdrop.value = 0;
    offset.value = withTiming(0, { duration: SHEET_IN_MS, easing: SHEET_EASING });
    backdrop.value = withTiming(1, { duration: SHEET_IN_MS, easing: SHEET_EASING });
  }, [offset, backdrop]);

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

      // The sheet tracks the keyboard down as it retracts, so there is no
      // second animation to keep in step with it.
      Keyboard.dismiss();

      backdrop.value = withTiming(0, { duration: SHEET_OUT_MS, easing: SHEET_EASING });
      offset.value = withTiming(
        heightRef.current,
        { duration: SHEET_OUT_MS, easing: SHEET_EASING },
        (finished) => {
          'worklet';
          if (finished) runOnJS(finishClose)();
        }
      );
    },
    [backdrop, offset, finishClose]
  );

  return {
    sheetStyle,
    backdropStyle,
    onSheetLayout,
    animateIn,
    close,
    runAfterClose,
  };
}
