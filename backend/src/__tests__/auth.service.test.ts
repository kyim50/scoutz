/**
 * Regression tests for the auth findings in the August 2026 audit.
 *
 * Each test names the bug it prevents. The login tests in particular cover
 * SEC-02, where a null password_hash caused the password check to be skipped
 * entirely and any password succeeded for Supabase-created accounts.
 */

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockRefreshSession = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockGetUserById = jest.fn();
const mockFrom = jest.fn();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { admin: { getUserById: (...a: unknown[]) => mockGetUserById(...a) } },
  },
  supabaseAuthClient: {
    auth: {
      signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a),
      signUp: (...a: unknown[]) => mockSignUp(...a),
      refreshSession: (...a: unknown[]) => mockRefreshSession(...a),
      resetPasswordForEmail: (...a: unknown[]) => mockResetPasswordForEmail(...a),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import authService from '../services/auth.service';
import { AppError } from '../utils/errors';

/**
 * Minimal PostgREST query-builder stand-in. Every filter method returns `this`
 * so chains of any shape resolve to the configured terminal result.
 */
function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ['select', 'eq', 'neq', 'gte', 'lte', 'or', 'order', 'limit', 'update', 'insert', 'delete', 'upsert']) {
    builder[method] = jest.fn(chain);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const SESSION = { access_token: 'access-abc', refresh_token: 'refresh-xyz' };

const APP_USER = {
  id: 'app-user-1',
  email: 'ada@example.com',
  name: 'Ada',
  username: 'ada',
  bio: null,
  avatar_url: null,
  reputation_score: 12,
  pins_created: 3,
  events_created: 1,
  supabase_auth_id: 'auth-1',
};

describe('login', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSignInWithPassword.mockReset();
  });

  it('rejects when Supabase rejects the credentials', async () => {
    mockFrom.mockReturnValue(queryResult({ data: APP_USER }));
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      authService.login({ identifier: 'ada@example.com', password: 'wrong' })
    ).rejects.toMatchObject({ code: 'LOGIN_FAILED', statusCode: 401 });
  });

  it('never bypasses the password check for accounts without a local hash (SEC-02)', async () => {
    // The old implementation skipped bcrypt entirely when password_hash was
    // null and issued tokens anyway. Credentials are now Supabase's to verify,
    // so a rejection there must be fatal no matter what our users row holds.
    mockFrom.mockReturnValue(queryResult({ data: { ...APP_USER, password_hash: null } }));
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      authService.login({ identifier: 'ada@example.com', password: 'literally-anything' })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns the same error for unknown usernames as for bad passwords', async () => {
    // Distinct errors would turn login into a username-enumeration oracle.
    mockFrom.mockReturnValue(queryResult({ data: null }));

    await expect(
      authService.login({ identifier: 'nobody', password: 'whatever' })
    ).rejects.toMatchObject({ code: 'LOGIN_FAILED', statusCode: 401 });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('resolves a username to an email before calling Supabase', async () => {
    mockFrom.mockReturnValue(queryResult({ data: APP_USER }));
    mockSignInWithPassword.mockResolvedValue({
      data: { session: SESSION, user: { id: 'auth-1', email: 'ada@example.com' } },
      error: null,
    });

    const result = await authService.login({ identifier: '@Ada', password: 'correct-horse' });

    // Username is normalised and exchanged for the email Supabase expects.
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct-horse',
    });
    expect(result.session.access_token).toBe('access-abc');
  });

  it('returns the Supabase session rather than a self-signed token (SEC-04)', async () => {
    // Access and refresh tokens used to be minted by us with one shared secret
    // and no type claim, making them interchangeable.
    mockFrom.mockReturnValue(queryResult({ data: APP_USER }));
    mockSignInWithPassword.mockResolvedValue({
      data: { session: SESSION, user: { id: 'auth-1', email: 'ada@example.com' } },
      error: null,
    });

    const result = await authService.login({ identifier: 'ada@example.com', password: 'pw' });

    expect(result.token).toBe(SESSION.access_token);
    expect(result.refreshToken).toBe(SESSION.refresh_token);
    expect(result.token).not.toBe(result.refreshToken);
  });
});

describe('signup', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSignUp.mockReset();
  });

  it('rejects a username that is already taken', async () => {
    // signup checks email first, then username — the mock has to distinguish
    // them or this passes for the wrong reason.
    mockFrom
      .mockReturnValueOnce(queryResult({ data: null })) // email is free
      .mockReturnValueOnce(queryResult({ data: { id: 'someone-else' } })); // username is not

    await expect(
      authService.signup({
        email: 'new@example.com',
        password: 'longenough',
        name: 'New',
        username: 'ada',
      })
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN', statusCode: 409 });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('points a returning pre-migration user at password reset', async () => {
    // Their email already exists, so telling them the *username* is taken sends
    // them off inventing new names instead of recovering their account.
    mockFrom.mockReturnValueOnce(queryResult({ data: { id: 'legacy-1' } }));

    await expect(
      authService.signup({
        email: 'kyim@example.com',
        password: 'longenough',
        name: 'Kimani',
        username: 'kyim50',
      })
    ).rejects.toMatchObject({ code: 'EMAIL_EXISTS', statusCode: 409 });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('reports when the project requires email confirmation', async () => {
    mockFrom.mockReturnValue(queryResult({ data: null }));
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'auth-2', email: 'new@example.com' }, session: null },
      error: null,
    });

    const result = await authService.signup({
      email: 'new@example.com',
      password: 'longenough',
      name: 'New',
    });

    // No session means the client must not be dropped into the app.
    expect(result).toEqual({ requiresEmailConfirmation: true });
  });

  it('surfaces an existing-account conflict as 409 rather than 500', async () => {
    mockFrom.mockReturnValue(queryResult({ data: null }));
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    await expect(
      authService.signup({ email: 'ada@example.com', password: 'longenough', name: 'Ada' })
    ).rejects.toMatchObject({ code: 'EMAIL_EXISTS', statusCode: 409 });
  });
});

describe('refreshToken', () => {
  it('rejects a token Supabase will not exchange', async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'bad' } });

    await expect(authService.refreshToken('not-a-real-token')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    });
  });

  it('returns a new session pair', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-access', refresh_token: 'new-refresh' } },
      error: null,
    });

    const result = await authService.refreshToken('refresh-xyz');

    expect(result.token).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
  });
});

describe('requestPasswordReset', () => {
  it('resolves even for an unknown address', async () => {
    // Throwing here would let a caller probe which emails are registered.
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });

    await expect(authService.requestPasswordReset('ghost@example.com')).resolves.toBeUndefined();
  });
});
