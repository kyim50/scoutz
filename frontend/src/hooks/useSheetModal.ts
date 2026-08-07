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
  SHEET_TRAVEL,
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
 * How long the sheet waits for the keyboard before entering on its own.
 * Long enough for keyboardWillShow after a focus, short enough that a step
 * with no input does not look stalled.
 */
const KEYBOARD_WAIT_MS = 120;

/**
 * Enter/exit and keyboard motion for a bottom sheet presented in a Modal.
 *
 * The sheet is positioned at bottom: 0 and moved entirely by one composed
 * transform: `translateY = offset - keyboardHeight`. Both movements therefore
 * share a single value and can never fight each other.
 *
 * Two behaviours matter more than they look:
 *
 * Entry and exit travel different distances, deliberately. Exit covers the
 * sheet's full measured height so it is genuinely gone before the backdrop
 * finishes — a short slide followed by the backdrop cutting out leaves the
 * sheet visibly on screen, which reads as a flash. Entry only covers a short
 * rise, because the keyboard already supplies most of the movement; entering
 * from full height meant crossing the sheet's height plus the keyboard's
 * inside one keyboard duration, which lurches.
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
  /** True between opening and the sheet actually starting to slide in. */
  const pendingEntryRef = useRef(false);
  const entryFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);

  /** Measures the sheet so exit travels exactly far enough to clear the screen. */
  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) heightRef.current = h;
    },
    []
  );

  /**
   * Slide the sheet in. Duration and easing are parameters so the entry can
   * borrow the keyboard's, which is what makes the two read as one movement.
   */
  const slideIn = useCallback(
    (duration: number, easing: typeof SHEET_EASING) => {
      if (!pendingEntryRef.current) return;
      pendingEntryRef.current = false;
      Animated.timing(offset, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }).start();
    },
    [offset]
  );

  const animateIn = useCallback(() => {
    closingRef.current = false;
    pendingEntryRef.current = true;
    // Entry is a short rise, not the full height. Exit has to clear the screen
    // so it is gone before the backdrop finishes, but entering from that far
    // means travelling the sheet's height *plus* the keyboard's in one keyboard
    // duration — around 3000px/sec, which reads as a lurch rather than a sheet
    // arriving. The keyboard supplies most of the movement; the sheet only has
    // to close the last stretch.
    offset.setValue(SHEET_TRAVEL);
    backdrop.setValue(0);

    // The backdrop is independent — it has nothing to sync with.
    Animated.timing(backdrop, {
      toValue: 1,
      duration: SHEET_IN_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    }).start();

    // The sheet waits briefly for the keyboard. When the input is focused on
    // open, keyboardWillShow lands within a frame or two and the sheet then
    // animates on the keyboard's exact duration and curve — so the composed
    // transform resolves to a single eased motion rather than two overlapping
    // ones finishing at different times.
    //
    // Nothing focuses on some steps, and hardware keyboards never show one, so
    // this falls back rather than leaving the sheet stranded off screen.
    entryFallbackRef.current = setTimeout(() => {
      slideIn(SHEET_IN_MS, SHEET_EASING);
    }, KEYBOARD_WAIT_MS);
  }, [backdrop, offset, slideIn]);

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
      pendingEntryRef.current = false;
      if (entryFallbackRef.current) {
        clearTimeout(entryFallbackRef.current);
        entryFallbackRef.current = null;
      }

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

      const duration = event.duration || KEYBOARD_FALLBACK_MS;

      // If the sheet is still waiting to enter, bring it in on exactly this
      // timeline. Identical duration and easing on both halves of
      // `offset - keyboard` means the composed value follows one clean curve.
      if (pendingEntryRef.current && toValue > 0) {
        if (entryFallbackRef.current) {
          clearTimeout(entryFallbackRef.current);
          entryFallbackRef.current = null;
        }
        slideIn(duration, KEYBOARD_EASING);
      }

      Animated.timing(keyboard, {
        toValue,
        duration,
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
  }, [visible, keyboard, slideIn]);

  // Reset when hidden so the next open starts from off screen rather than
  // wherever the last dismissal left it.
  useEffect(() => {
    if (!visible) {
      closingRef.current = false;
      pendingEntryRef.current = false;
      if (entryFallbackRef.current) {
        clearTimeout(entryFallbackRef.current);
        entryFallbackRef.current = null;
      }
      keyboard.setValue(0);
      offset.setValue(SHEET_TRAVEL);
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
