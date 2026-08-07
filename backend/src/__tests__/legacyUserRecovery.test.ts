/**
 * Regression tests for the migration gap that locked out every pre-existing user.
 *
 * After moving to Supabase Auth, accounts that existed only in `public.users`
 * had no Supabase Auth identity. That left them with no way back in:
 *   - signup  -> 409, their email/username is already taken
 *   - login   -> 401, no auth identity to authenticate against
 *   - reset   -> silently no-ops, no auth account to send a reset for
 *
 * The reset path is the only safe recovery route (signup must not "claim" an
 * existing account, or knowing an email would be enough to take it over), so
 * it now provisions the missing auth identity before sending the email.
 */

const mockResetPasswordForEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockListUsers = jest.fn();
const mockFrom = jest.fn();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      admin: {
        createUser: (...a: unknown[]) => mockCreateUser(...a),
        listUsers: (...a: unknown[]) => mockListUsers(...a),
        getUserById: jest.fn(),
      },
    },
  },
  supabaseAuthClient: {
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => mockResetPasswordForEmail(...a),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import authService from '../services/auth.service';

function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'update', 'insert', 'limit', 'order']) {
    builder[m] = jest.fn(() => builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return builder;
}

const LEGACY_USER = {
  id: 'legacy-1',
  email: 'kyim@example.com',
  username: 'kyim50',
  supabase_auth_id: null,
};

describe('password reset for a legacy user with no auth identity', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockCreateUser.mockReset();
    mockListUsers.mockReset();
    mockResetPasswordForEmail.mockReset();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('provisions the missing Supabase Auth identity before sending the email', async () => {
    mockFrom.mockReturnValue(queryResult({ data: LEGACY_USER }));
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-auth-id', email: LEGACY_USER.email } },
      error: null,
    });

    await authService.requestPasswordReset(LEGACY_USER.email);

    // Without this the reset email is sent for an account that does not exist,
    // and the user is stranded with no way in.
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: LEGACY_USER.email, email_confirm: true })
    );
    expect(mockResetPasswordForEmail).toHaveBeenCalled();
  });

  it('links the new auth id back onto the existing users row', async () => {
    const builder = queryResult({ data: LEGACY_USER });
    mockFrom.mockReturnValue(builder);
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-auth-id', email: LEGACY_USER.email } },
      error: null,
    });

    await authService.requestPasswordReset(LEGACY_USER.email);

    // Without the link, the user signs in but gets a brand new profile and
    // loses their pins, events and reputation.
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ supabase_auth_id: 'new-auth-id' })
    );
  });

  it('does not create a duplicate when the auth identity already exists', async () => {
    mockFrom.mockReturnValue(
      queryResult({ data: { ...LEGACY_USER, supabase_auth_id: 'already-linked' } })
    );

    await authService.requestPasswordReset(LEGACY_USER.email);

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockResetPasswordForEmail).toHaveBeenCalled();
  });

  it('still sends nothing away for an unknown email, and does not throw', async () => {
    mockFrom.mockReturnValue(queryResult({ data: null }));

    // Must resolve regardless, or the endpoint becomes an enumeration oracle.
    await expect(authService.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('does not throw when provisioning fails', async () => {
    mockFrom.mockReturnValue(queryResult({ data: LEGACY_USER }));
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({ data: { user: null }, error: { message: 'boom' } });

    // A failure here must not reveal that the account exists.
    await expect(authService.requestPasswordReset(LEGACY_USER.email)).resolves.toBeUndefined();
  });
});
