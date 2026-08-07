import {
  parseAuthRedirect,
  parseAuthRedirectError,
  isRecoveryRedirect,
} from '../authLinking';

/**
 * Supabase has shipped auth redirects with the payload in the hash fragment and
 * in the query string at different times, and the reset flow is unrecoverable
 * for the user if parsing silently returns nothing. Both shapes are covered.
 */

const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.access';
const REFRESH = 'v1.refresh-token-value';

describe('parseAuthRedirect', () => {
  it('reads tokens from the hash fragment', () => {
    const url = `cite://auth/callback#access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`;

    expect(parseAuthRedirect(url)).toEqual({
      accessToken: ACCESS,
      refreshToken: REFRESH,
      type: 'recovery',
    });
  });

  it('reads tokens from the query string', () => {
    const url = `cite://auth/callback?access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`;

    expect(parseAuthRedirect(url)?.accessToken).toBe(ACCESS);
  });

  it('handles a URL carrying both, preferring the fragment', () => {
    const url = `cite://auth/callback?type=signup#access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`;

    expect(parseAuthRedirect(url)?.type).toBe('recovery');
  });

  it('works with an https redirect, not just the app scheme', () => {
    const url = `https://traverseapp.com/auth/callback#access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`;

    expect(parseAuthRedirect(url)?.refreshToken).toBe(REFRESH);
  });

  it.each([
    ['a plain deep link', 'cite://map'],
    ['a link with no refresh token', `cite://auth/callback#access_token=${ACCESS}`],
    ['an empty string', ''],
  ])('returns null for %s', (_label, url) => {
    expect(parseAuthRedirect(url)).toBeNull();
  });
});

describe('parseAuthRedirectError', () => {
  it('surfaces an expired link', () => {
    const url =
      'cite://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    const result = parseAuthRedirectError(url);

    expect(result?.error).toBe('access_denied');
    // '+' is the URL encoding of a space; left raw it reads as gibberish.
    expect(result?.description).toBe('Email link is invalid or has expired');
  });

  it('returns null for a successful redirect', () => {
    const url = `cite://auth/callback#access_token=${ACCESS}&refresh_token=${REFRESH}`;

    expect(parseAuthRedirectError(url)).toBeNull();
  });
});

describe('isRecoveryRedirect', () => {
  it('distinguishes recovery from email confirmation', () => {
    expect(
      isRecoveryRedirect(`cite://auth/callback#access_token=${ACCESS}&type=recovery`)
    ).toBe(true);
    expect(
      isRecoveryRedirect(`cite://auth/callback#access_token=${ACCESS}&type=signup`)
    ).toBe(false);
  });
});
