import { useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  KeyboardEvent,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import {
  SHEET_EASING,
  SHEET_IN_MS,
  SHEET_OUT_MS,
  KEYBOARD_EASING,
  KEYBOARD_FALLBACK_MS,
} from '../lib/motion';

interface Options {
  visible: boolean;
  onClose: () => void;
}

/** Used until the sheet has been measured; always clears the screen. */
const FALLBACK_HEIGHT = Dimensions.get('window').height;

/**
 * Enter/exit and keyboard motion for a bottom sheet presented in a Modal.
 *
 * The sheet is positioned at bottom: 0 and moved entirely by one composed
 * transform: `translateY = offset - keyboardHeight`. Both movements therefore
 * share a single value and can never fight each other.
 *
 * Two behaviours matter more than they look:
 *
 * Exit travels the sheet's full measured height, not a fixed 80px. Sliding a
 * short distance and cutting the backdrop leaves the sheet visibly on screen
 * as everything disappears, which reads as a flash. Travelling its own height
 * means it is genuinely gone before the backdrop finishes.
 *
 * During exit the keyboard is driven to zero on the same timeline as the sheet.
 * Letting the system animate it on its own schedule made the sheet drop in two
 * stages — once from the keyboard retracting, once from the sheet leaving.
 */
export function useSheetModal({ visible, onClose }: Options) {
  const backdrop = useRef(new Animated.Value(0)).current;
  /** Downward offset in px. 0 is fully presented. */
  const offset = useRef(new Animated.Value(FALLBACK_HEIGHT)).current;
  const keyboard = useRef(new Animated.Value(0)).current;

  const heightRef = useRef(FALLBACK_HEIGHT);
  /** While closing, the hook owns the keyboard value and system events are ignored. */
  const closingRef = useRef(false);
  const afterCloseRef = useRef<(() => void) | null>(null);

  /** Measures the sheet so entry and exit travel exactly its own height. */
  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) heightRef.current = h;
    },
    []
  );

  const animateIn = useCallback(() => {
    closingRef.current = false;
    offset.setValue(heightRef.current);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: SHEET_IN_MS,
        easing: SHEET_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration: SHEET_IN_MS,
        easing: SHEET_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, offset]);

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

  const close = useCallback(
    (after?: () => void) => {
      // Guarded because this doubles as an onPress handler, which would
      // otherwise hand us a touch event to "call" after dismissal.
      afterCloseRef.current = typeof after === 'function' ? after : null;
      closingRef.current = true;

      // Dismiss the native keyboard, but drive our own value below so both
      // movements finish together instead of the sheet dropping twice.
      Keyboard.dismiss();

      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: SHEET_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: heightRef.current,
          duration: SHEET_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(keyboard, {
          toValue: 0,
          duration: SHEET_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        // iOS reports real dismissal through Modal.onDismiss; Android does not.
        if (Platform.OS !== 'ios') runAfterClose();
      });
    },
    [backdrop, offset, keyboard, onClose, runAfterClose]
  );

  useEffect(() => {
    if (!visible) return;

    // `will` events fire before the keyboard moves, which is what lets the
    // sheet travel with it rather than chase it. Android only has `did`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animateKeyboard = (toValue: number, event: KeyboardEvent) => {
      // During close the hook drives this value itself.
      if (closingRef.current) return;
      Animated.timing(keyboard, {
        toValue,
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
    // Deliberately not depending on the keyboard value: an earlier version
    // re-subscribed on every change, tearing down listeners mid-animation.
  }, [visible, keyboard]);

  // Reset when hidden so the next open starts from off screen rather than
  // wherever the last dismissal left it.
  useEffect(() => {
    if (!visible) {
      closingRef.current = false;
      keyboard.setValue(0);
      offset.setValue(heightRef.current);
      backdrop.setValue(0);
    }
  }, [visible, keyboard, offset, backdrop]);

  return {
    backdropOpacity: backdrop,
    /** Entry offset minus keyboard height — one transform for both movements. */
    sheetTranslateY: Animated.subtract(offset, keyboard),
    keyboardHeight: keyboard,
    onSheetLayout,
    animateIn,
    close,
    runAfterClose,
  };
}
