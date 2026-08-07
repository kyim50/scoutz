/**
 * Parsing for Supabase auth redirect links (password recovery, email confirm).
 *
 * The password reset is initiated by our backend, not the client, so the PKCE
 * flow is not usable here: the code verifier would be generated on the server
 * and the app would have no way to complete the exchange. The implicit flow is
 * used instead, which returns the session directly in the redirect URL.
 *
 * Supabase has shipped both shapes over time, so both are handled:
 *   cite://auth/callback#access_token=...&refresh_token=...&type=recovery
 *   cite://auth/callback?access_token=...&refresh_token=...&type=recovery
 */

export interface AuthRedirect {
  accessToken: string;
  refreshToken: string;
  /** 'recovery' for password reset, 'signup' for email confirmation. */
  type: string | null;
}

export interface AuthRedirectError {
  error: string;
  description: string | null;
}

/** Pull key/value pairs from both the query string and the hash fragment. */
function paramsFrom(url: string): URLSearchParams {
  const merged = new URLSearchParams();

  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  if (queryStart !== -1) {
    const end = hashStart > queryStart ? hashStart : url.length;
    for (const [k, v] of new URLSearchParams(url.slice(queryStart + 1, end))) {
      merged.set(k, v);
    }
  }

  if (hashStart !== -1) {
    for (const [k, v] of new URLSearchParams(url.slice(hashStart + 1))) {
      merged.set(k, v);
    }
  }

  return merged;
}

/**
 * Extract a session from a Supabase redirect URL.
 * Returns null when the URL is not an auth callback.
 */
export function parseAuthRedirect(url: string): AuthRedirect | null {
  if (!url) return null;

  const params = paramsFrom(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken, type: params.get('type') };
}

/**
 * Supabase reports failures on the redirect too — an expired or already-used
 * link arrives as `error=access_denied&error_code=otp_expired`. Without this the
 * app would silently do nothing and the user would have no idea why.
 */
export function parseAuthRedirectError(url: string): AuthRedirectError | null {
  if (!url) return null;

  const params = paramsFrom(url);
  const error = params.get('error') || params.get('error_code');
  if (!error) return null;

  return {
    error,
    description: params.get('error_description')?.replace(/\+/g, ' ') ?? null,
  };
}

/** True when this redirect is a password recovery link. */
export function isRecoveryRedirect(url: string): boolean {
  return paramsFrom(url).get('type') === 'recovery';
}
