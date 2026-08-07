import { useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

export type UsernameStatus =
  | 'idle'
  | 'too-short'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'error';

const MIN_LENGTH = 3;
const MAX_LENGTH = 30;
const DEBOUNCE_MS = 400;
/** Letters, digits, underscore and dot — matches what the input already allows. */
const VALID_PATTERN = /^[a-z0-9_.]+$/;

/**
 * Live username availability.
 *
 * Signup previously validated only `length >= 3` on this step, so a taken
 * username sailed through every remaining step and failed at submit — after
 * the user had entered everything else.
 *
 * Debounced so typing doesn't fire a request per keystroke, and responses are
 * matched against the current value so a slow reply for an earlier value can't
 * overwrite a newer result.
 */
export function useUsernameAvailability(username: string) {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const latestRef = useRef(username);

  useEffect(() => {
    const value = username.trim().toLowerCase();
    latestRef.current = value;

    if (!value) {
      setStatus('idle');
      return;
    }
    if (value.length < MIN_LENGTH) {
      setStatus('too-short');
      return;
    }
    if (value.length > MAX_LENGTH || !VALID_PATTERN.test(value)) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');

    const timer = setTimeout(async () => {
      try {
        const available = await authAPI.isUsernameAvailable(value);
        // Ignore a reply that arrived after the user typed something else.
        if (latestRef.current !== value) return;
        setStatus(available ? 'available' : 'taken');
      } catch {
        if (latestRef.current !== value) return;
        // Network trouble shouldn't hard-block signup; the server checks again
        // at submit, so let them continue rather than trapping them here.
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [username]);

  return {
    status,
    /** Safe to move on: confirmed free, or we couldn't check and the server will. */
    canProceed: status === 'available' || status === 'error',
    message: MESSAGES[status],
  };
}

const MESSAGES: Record<UsernameStatus, string | null> = {
  idle: null,
  'too-short': `At least ${MIN_LENGTH} characters.`,
  invalid: 'Letters, numbers, underscores and dots only.',
  checking: 'Checking availability…',
  available: "That one's free.",
  taken: 'That username is taken. Try another.',
  error: "Couldn't check right now — you can continue.",
};
