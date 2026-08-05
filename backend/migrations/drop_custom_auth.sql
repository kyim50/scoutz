-- ============================================================================
-- Retire the custom authentication system.
--
-- Supabase Auth is now the single source of truth for credentials. The app no
-- longer signs its own JWTs, hashes passwords, or issues magic links, so the
-- supporting tables and columns are dead weight — and `password_hash` is a
-- liability worth removing rather than leaving behind.
--
-- Run AFTER deploying the backend that no longer reads these. Order matters:
-- the running app must stop referencing them first.
--
-- NOTE: existing password users must complete a one-time password reset. Their
-- old bcrypt hashes live in `users.password_hash` and cannot be transferred to
-- Supabase Auth, which stores its own credentials in the `auth` schema.
-- ============================================================================

-- Magic links were never wired up on the client; the endpoints were live but
-- the app's AuthContext threw "Magic link is disabled" for all three methods.
DROP TABLE IF EXISTS magic_links;

-- Superseded by Supabase Auth user_metadata, which carries name/username
-- through signup without a staging table.
DROP TABLE IF EXISTS pending_signups;

-- Storing hashes we no longer verify is pure downside: it is the single most
-- valuable thing in the database to an attacker and it now protects nothing.
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Every user must map to a Supabase Auth identity from here on.
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id
  ON users (supabase_auth_id)
  WHERE supabase_auth_id IS NOT NULL;

-- Username lookup backs login-by-username and the availability check.
CREATE INDEX IF NOT EXISTS idx_users_username
  ON users (username)
  WHERE username IS NOT NULL;
