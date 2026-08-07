import { useRef, useCallback, useEffect } from 'react';
import { Keyboard, Platform, LayoutChangeEvent, Dimensions, KeyboardEvent } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { SHEET_EASING, SHEET_IN_MS, SHEET_OUT_MS } from '../lib/motion';

interface Options {
  visible: boolean;
  onClose: () => void;
}

/**
 * Start offset used before the sheet has been measured, on the very first open.
 * Bounded rather than the full screen height so the first entry has no more
 * distance to cover than it needs.
 */
const FALLBACK_HEIGHT = Dimensions.get('window').height * 0.7;

/** If no keyboard appears, enter anyway rather than sitting off screen. */
const KEYBOARD_WAIT_MS = 100;

/**
 * Enter/exit and keyboard motion for a bottom sheet presented in a Modal.
 *
 * There is exactly one animated value: the sheet's Y position. Its target
 * already includes the keyboard height, so the sheet makes a single move from
 * off screen to its final place above the keyboard — it never rests at the
 * bottom of the screen first.
 *
 * That matters because a previous version composed `offset - keyboard.height`
 * using Reanimated's `useAnimatedKeyboard`. Instrumenting it on device showed
 * why it could not work inside a React Native Modal, which is a separate
 * UIWindow on iOS: the keyboard value arrived 460ms after the sheet began
 * animating, and jumped straight from 0 to 335 rather than tracking the
 * keyboard frame by frame. So the sheet completed its entry, parked at the
 * bottom where the rising keyboard covered all but a few pixels of it, and then
 * snapped upward when the value finally landed. That is the "appears small
 * behind the keyboard, then jumps up full" behaviour, and no duration or easing
 * could have fixed it — the position was simply wrong for 460ms.
 *
 * `keyboardWillShow` fires *before* the keyboard moves and carries both its
 * final height and its duration, which is precisely what is needed to choose
 * the target and match the timing up front.
 */
export function useSheetModal({ visible, onClose }: Options) {
  /** The sheet's Y position. Positive is below its resting place. */
  const translateY = useSharedValue(FALLBACK_HEIGHT);
  /** Dim behind the sheet. Independent of position — nothing to sync it with. */
  const backdrop = useSharedValue(0);

  const heightRef = useRef(FALLBACK_HEIGHT);
  /** Latest known keyboard height, so mid-session changes reposition correctly. */
  const keyboardHeightRef = useRef(0);
  /** True between opening and the sheet committing to its entry. */
  const pendingEntryRef = useRef(false);
  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const onSheetLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) heightRef.current = h;
  }, []);

  const clearEntryTimer = () => {
    if (entryTimerRef.current) {
      clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
  };

  /** Move to the resting place above the keyboard, in one animation. */
  const settle = useCallback(
    (keyboardHeight: number, duration: number) => {
      pendingEntryRef.current = false;
      clearEntryTimer();
      keyboardHeightRef.current = keyboardHeight;
      translateY.value = withTiming(-keyboardHeight, { duration, easing: SHEET_EASING });
    },
    [translateY]
  );

  const animateIn = useCallback(() => {
    clearEntryTimer();
    pendingEntryRef.current = true;
    keyboardHeightRef.current = 0;
    // Start off screen and wait a beat. The caller focuses an input straight
    // after this, so keyboardWillShow normally lands within a frame or two and
    // supplies the real target before the fallback fires.
    translateY.value = heightRef.current;
    backdrop.value = withTiming(1, { duration: SHEET_IN_MS, easing: SHEET_EASING });
    entryTimerRef.current = setTimeout(() => {
      if (pendingEntryRef.current) settle(0, SHEET_IN_MS);
    }, KEYBOARD_WAIT_MS);
  }, [translateY, backdrop, settle]);

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
      pendingEntryRef.current = false;
      clearEntryTimer();
      Keyboard.dismiss();
      backdrop.value = withTiming(0, { duration: SHEET_OUT_MS, easing: SHEET_EASING });

      // Straight down past the bottom from wherever it currently sits.
      translateY.value = withTiming(
        heightRef.current,
        { duration: SHEET_OUT_MS, easing: SHEET_EASING },
        (finished) => {
          'worklet';
          if (finished) runOnJS(finishClose)();
        }
      );
    },
    [translateY, backdrop, finishClose]
  );

  useEffect(() => {
    if (!visible) return;

    // `will` events fire before the keyboard moves and carry its final height
    // and duration — early enough to aim the sheet at its destination rather
    // than follow the keyboard there.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      const duration = e.duration || SHEET_IN_MS;

      if (pendingEntryRef.current) {
        // Entering: one move from off screen to above the keyboard.
        settle(height, duration);
      } else if (Math.abs(keyboardHeightRef.current - height) > 1) {
        // Already open and the keyboard changed height (autocomplete bar, a
        // different keyboard) — follow it on its own timing.
        keyboardHeightRef.current = height;
        translateY.value = withTiming(-height, { duration, easing: SHEET_EASING });
      }
    };

    const onHide = (e: KeyboardEvent) => {
      if (pendingEntryRef.current) return;
      keyboardHeightRef.current = 0;
      translateY.value = withTiming(0, {
        duration: e.duration || SHEET_OUT_MS,
        easing: SHEET_EASING,
      });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, settle, translateY]);

  // Park off screen while hidden so the next open starts from the right place.
  useEffect(() => {
    if (!visible) {
      pendingEntryRef.current = false;
      clearEntryTimer();
      keyboardHeightRef.current = 0;
      translateY.value = heightRef.current;
      backdrop.value = 0;
    }
  }, [visible, translateY, backdrop]);

  return {
    sheetStyle,
    backdropStyle,
    onSheetLayout,
    animateIn,
    close,
    runAfterClose,
  };
}
