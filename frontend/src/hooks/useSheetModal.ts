import { useRef, useEffect, useCallback } from 'react';
import { Animated, Keyboard, Platform, KeyboardEvent } from 'react-native';
import {
  SHEET_EASING,
  SHEET_IN_MS,
  SHEET_OUT_MS,
  SHEET_TRAVEL,
  KEYBOARD_EASING,
  KEYBOARD_FALLBACK_MS,
} from '../lib/motion';

interface Options {
  visible: boolean;
  onClose: () => void;
}

/**
 * Enter/exit and keyboard motion for a bottom sheet presented in a Modal.
 *
 * Shared by the auth sheets so they move identically. Three things it fixes:
 *
 * 1. Enter used a spring and exit a timing, so the sheet had two different
 *    personalities. Both now use the same ease-out curve, exit slightly faster.
 *
 * 2. The keyboard offset was React state written to `bottom` and `height` —
 *    layout properties, applied instantly. The sheet jumped rather than moved.
 *    It is now an Animated.Value composed into the sheet's transform, driven
 *    with the duration iOS reports on the keyboard event so the two travel
 *    together.
 *
 * 3. Everything is a transform, so the whole thing runs on the native driver
 *    and stays smooth while JS is busy.
 */
export function useSheetModal({ visible, onClose }: Options) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const keyboard = useRef(new Animated.Value(0)).current;

  /** Queued until the native modal is fully gone — see runAfterClose. */
  const afterCloseRef = useRef<(() => void) | null>(null);

  const animateIn = useCallback(() => {
    backdrop.setValue(0);
    sheet.setValue(SHEET_TRAVEL);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: SHEET_IN_MS,
        easing: SHEET_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(sheet, {
        toValue: 0,
        duration: SHEET_IN_MS,
        easing: SHEET_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, sheet]);

  /**
   * Run queued work once the modal has actually gone.
   *
   * Presenting another native modal while this one is dismissing leaves an
   * invisible modal on screen swallowing touches, which looks like the app
   * has frozen.
   */
  const runAfterClose = useCallback(() => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    fn?.();
  }, []);

  const close = useCallback(
    (after?: () => void) => {
      // Guarded because this is also used directly as an onPress handler, which
      // would otherwise hand us a touch event to "call" after dismissal.
      afterCloseRef.current = typeof after === 'function' ? after : null;
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: SHEET_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: SHEET_TRAVEL,
          duration: SHEET_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        // iOS reports the real dismissal through Modal.onDismiss; Android has
        // no equivalent, so this is the moment there.
        if (Platform.OS !== 'ios') runAfterClose();
      });
    },
    [backdrop, sheet, onClose, runAfterClose]
  );

  useEffect(() => {
    if (!visible) return;

    // `will` events fire before the keyboard moves, which is what lets the
    // sheet travel with it rather than chase it. Android only has `did`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animateKeyboard = (toValue: number, event: KeyboardEvent) => {
      Animated.timing(keyboard, {
        toValue,
        // iOS reports its own duration; matching it keeps them in lockstep.
        duration: event.duration || KEYBOARD_FALLBACK_MS,
        easing: KEYBOARD_EASING,
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, (e) =>
      animateKeyboard(e.endCoordinates.height, e)
    );
    const hideSub = Keyboard.addListener(hideEvent, (e) => animateKeyboard(0, e));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
    // Deliberately not depending on the offset: the old version re-subscribed
    // on every keyboard change, tearing down listeners mid-animation.
  }, [visible, keyboard]);

  // Reset when hidden so the next open starts from the bottom rather than
  // wherever the last dismissal left it.
  useEffect(() => {
    if (!visible) {
      keyboard.setValue(0);
      sheet.setValue(SHEET_TRAVEL);
      backdrop.setValue(0);
    }
  }, [visible, keyboard, sheet, backdrop]);

  return {
    backdropOpacity: backdrop,
    /** Entry offset minus keyboard height — one transform for both movements. */
    sheetTranslateY: Animated.subtract(sheet, keyboard),
    keyboardHeight: keyboard,
    animateIn,
    close,
    runAfterClose,
  };
}
