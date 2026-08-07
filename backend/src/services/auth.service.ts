import { supabaseAdmin, supabaseAuthClient } from '../config/supabase';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

/**
 * Supabase Auth is the single source of truth for credentials. This service
 * never signs its own tokens and never stores a password hash — it exchanges
 * credentials for a Supabase session and keeps our `users` row in sync with the
 * Supabase Auth user via `supabase_auth_id`.
 */

export interface SignupData {
  email: string;
  password: string;
  name: string;
  username?: string;
}

export interface LoginData {
  /** Email or username. */
  identifier: string;
  password: string;
}

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
}

/** Shape returned to the client — mirrors the old response so screens don't change. */
interface AuthResult {
  user: PublicUser;
  session: SupabaseSession;
  /** @deprecated Kept so older builds keep working; same value as session.access_token. */
  token: string;
  refreshToken: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  pinsCreated: number;
  eventsCreated: number;
}

function toPublicUser(row: Record<string, any>): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    username: row.username ?? null,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    reputationScore: row.reputation_score ?? 0,
    pinsCreated: row.pins_created ?? 0,
    eventsCreated: row.events_created ?? 0,
  };
}

function normalizeUsername(username?: string | null): string | null {
  if (!username) return null;
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  return clean || null;
}

/** Requires a local part before the @ and a dot in the domain. */
function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export class AuthService {
  /** True when no other user already holds this username. */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const clean = normalizeUsername(username);
    if (!clean) return false;

    let query = supabaseAdmin.from('users').select('id').eq('username', clean);
    if (excludeUserId) query = query.neq('id', excludeUserId);

    const { data } = await query.maybeSingle();
    return !data;
  }

  async signup(data: SignupData): Promise<AuthResult | { requiresEmailConfirmation: true }> {
    const email = data.email.trim().toLowerCase();
    const username = normalizeUsername(data.username);

    // Check the email first. Someone re-registering their own pre-migration
    // account would otherwise be told their username was taken — by their own
    // account — which reads as a name collision rather than "you already have
    // an account", and sends them off inventing new usernames.
    const { data: existingByEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingByEmail) {
      throw new AppError(
        'EMAIL_EXISTS',
        'You already have an account with this email. Use "Forgot your password?" to get back in.',
        409
      );
    }

    if (username && !(await this.isUsernameAvailable(username))) {
      throw new AppError('USERNAME_TAKEN', 'Username is already taken', 409);
    }

    const { data: signUpData, error } = await supabaseAuthClient.auth.signUp({
      email,
      password: data.password,
      options: {
        // Read back in findOrCreateUserFromSupabaseAuth when the app row is created.
        data: { name: data.name.trim(), username },
        // Without this the confirmation link lands on the project's Site URL
        // rather than the app, so tapping it appears to do nothing at all.
        emailRedirectTo: process.env.EMAIL_CONFIRM_REDIRECT_URL
          || process.env.PASSWORD_RESET_REDIRECT_URL
          || undefined,
      },
    });

    if (error) {
      logger.error('Supabase signup error:', error);
      if (error.message?.toLowerCase().includes('already registered')) {
        throw new AppError('EMAIL_EXISTS', 'An account with this email already exists. Log in instead.', 409);
      }
      throw new AppError('SIGNUP_FAILED', error.message || 'Failed to create account', 400);
    }

    const authUser = signUpData.user;
    if (!authUser) {
      throw new AppError('SIGNUP_FAILED', 'Failed to create account', 500);
    }

    // Project has email confirmation enabled — no session until they click through.
    if (!signUpData.session) {
      return { requiresEmailConfirmation: true };
    }

    const user = await this.findOrCreateUserFromSupabaseAuth(authUser.id, email, {
      name: data.name.trim(),
      username,
    });

    return this.buildResult(user, signUpData.session);
  }

  async login(data: LoginData): Promise<AuthResult> {
    const identifier = data.identifier.trim();

    // Supabase Auth only accepts an email. Resolving username -> email here
    // (rather than in a public endpoint) preserves username login without
    // exposing an email-enumeration oracle.
    //
    // Note this is not a bare `includes('@')`: the app renders usernames as
    // "@ada", so a leading @ marks a username, not an email address.
    const email = looksLikeEmail(identifier)
      ? identifier.toLowerCase()
      : await this.emailForUsername(identifier);

    if (!email) {
      throw new AppError('LOGIN_FAILED', 'Invalid email/username or password', 401);
    }

    const { data: signInData, error } = await supabaseAuthClient.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !signInData.session || !signInData.user) {
      logger.warn('Failed login attempt', { identifier, reason: error?.message });
      throw new AppError('LOGIN_FAILED', 'Invalid email/username or password', 401);
    }

    const user = await this.findOrCreateUserFromSupabaseAuth(
      signInData.user.id,
      signInData.user.email ?? email
    );

    await supabaseAdmin
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);

    return this.buildResult(user, signInData.session);
  }

  /** Exchange a Supabase refresh token for a new session. */
  async refreshToken(refreshToken: string): Promise<{ session: SupabaseSession; token: string; refreshToken: string }> {
    const { data, error } = await supabaseAuthClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new AppError('INVALID_TOKEN', 'Invalid refresh token', 401);
    }

    return {
      session: data.session as SupabaseSession,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /** Send a password reset email. Always resolves, so it can't be used to probe for accounts. */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL || undefined;

    // Accounts that predate the Supabase Auth migration exist only in
    // `public.users`. resetPasswordForEmail is a no-op for them, which left
    // them unable to sign up (email taken), log in (no identity) or reset —
    // no way back into the app at all. Provision the identity first.
    await this.ensureAuthIdentityForLegacyUser(normalized);

    const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });

    if (error) {
      // Logged, not thrown: the response must look identical whether or not
      // the address is registered.
      logger.warn('Password reset request failed', { email: normalized, reason: error.message });
    }
  }

  /**
   * Give a pre-migration user a Supabase Auth identity so the reset flow can
   * reach them, and link it to their existing row so they keep their pins,
   * events and reputation.
   *
   * Creates no password: the reset email they are about to receive is what sets
   * it. Never throws — a failure here must not reveal whether the account
   * exists.
   */
  private async ensureAuthIdentityForLegacyUser(email: string): Promise<void> {
    try {
      const { data: appUser } = await supabaseAdmin
        .from('users')
        .select('id, email, username, supabase_auth_id')
        .eq('email', email)
        .maybeSingle();

      // No local account, or already migrated — nothing to do.
      if (!appUser || appUser.supabase_auth_id) return;

      // An auth identity may already exist unlinked (a partially completed
      // migration); adopt it rather than colliding on the unique email.
      const existingAuthId = await this.findAuthUserIdByEmail(email);

      let authId = existingAuthId;
      if (!authId) {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          // Their address is already proven by the pre-migration account, and
          // requiring confirmation would add a second email to an already
          // awkward recovery.
          email_confirm: true,
          user_metadata: {
            name: (appUser as any).name ?? undefined,
            username: appUser.username ?? undefined,
          },
        });

        if (error || !created?.user) {
          logger.error('Could not provision auth identity for legacy user', {
            email,
            reason: error?.message,
          });
          return;
        }
        authId = created.user.id;
      }

      const { error: linkError } = await supabaseAdmin
        .from('users')
        .update({ supabase_auth_id: authId })
        .eq('id', appUser.id);

      if (linkError) {
        logger.error('Could not link auth identity to legacy user', {
          email,
          reason: linkError.message,
        });
        return;
      }

      logger.info('Provisioned auth identity for legacy user', { userId: appUser.id });
    } catch (err) {
      logger.error('ensureAuthIdentityForLegacyUser failed', { email, err });
    }
  }

  /** Look up a Supabase Auth user id by email, or null. */
  private async findAuthUserIdByEmail(email: string): Promise<string | null> {
    try {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      const match = data?.users?.find(
        (u: { email?: string }) => (u.email ?? '').toLowerCase() === email
      );
      return match?.id ?? null;
    } catch {
      return null;
    }
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    return toPublicUser(data);
  }

  /**
   * Resolve the app `users` row for a Supabase Auth user, creating and linking
   * it on first sign-in. `metadata` comes from the signup call; on later logins
   * it is read back off the Supabase user record instead.
   */
  async findOrCreateUserFromSupabaseAuth(
    supabaseAuthId: string,
    email: string,
    metadata?: { name?: string; username?: string | null }
  ): Promise<PublicUser> {
    const normalized = email.trim().toLowerCase();

    const { data: existingByAuth } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('supabase_auth_id', supabaseAuthId)
      .maybeSingle();

    if (existingByAuth) return toPublicUser(existingByAuth);

    // Pre-existing row from the old password system — link it rather than
    // creating a duplicate.
    const { data: existingByEmail } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', normalized)
      .maybeSingle();

    if (existingByEmail) {
      const { data: linked } = await supabaseAdmin
        .from('users')
        .update({ supabase_auth_id: supabaseAuthId })
        .eq('id', existingByEmail.id)
        .select()
        .single();

      return toPublicUser(linked ?? existingByEmail);
    }

    const resolved = metadata ?? (await this.metadataForAuthUser(supabaseAuthId));
    const name = resolved?.name?.trim() || 'User';
    let username = normalizeUsername(resolved?.username);

    // Someone may have claimed it between signup and first sign-in.
    if (username && !(await this.isUsernameAvailable(username))) {
      logger.warn('Username taken by the time the account was created', { username });
      username = null;
    }

    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert({
        supabase_auth_id: supabaseAuthId,
        email: normalized,
        name,
        username,
      })
      .select()
      .single();

    if (error) {
      // Lost a race with a concurrent request for the same user — re-read.
      if (error.code === '23505') {
        const { data: raced } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('supabase_auth_id', supabaseAuthId)
          .maybeSingle();
        if (raced) return toPublicUser(raced);
      }
      logger.error('Error creating user from Supabase Auth:', error);
      throw new AppError('SIGNUP_FAILED', 'Failed to create user', 500);
    }

    return toPublicUser(created);
  }

  // ─── internals ──────────────────────────────────────────────

  private async emailForUsername(username: string): Promise<string | null> {
    const clean = normalizeUsername(username);
    if (!clean) return null;

    const { data } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('username', clean)
      .maybeSingle();

    return data?.email ?? null;
  }

  private async metadataForAuthUser(
    supabaseAuthId: string
  ): Promise<{ name?: string; username?: string | null } | null> {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(supabaseAuthId);
      const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
      if (!meta) return null;
      return {
        name: typeof meta.name === 'string' ? meta.name : undefined,
        username: typeof meta.username === 'string' ? meta.username : null,
      };
    } catch (err) {
      logger.warn('Could not read Supabase user metadata', { supabaseAuthId, err });
      return null;
    }
  }

  private buildResult(user: PublicUser, session: SupabaseSession): AuthResult {
    return {
      user,
      session,
      token: session.access_token,
      refreshToken: session.refresh_token,
    };
  }
}

export default new AuthService();
