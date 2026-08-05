-- Expo push token for the user's most recent device.
--
-- user.service.savePushToken and push.service.notifyUsers both reference this
-- column, but no migration ever created it. Every push notification the app
-- attempted (RSVP, event chat, pin verified, event cancelled) failed silently
-- because the write was caught-and-logged and the read returned an error.

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- notifyUsers filters on `push_token IS NOT NULL` for a batch of user ids.
CREATE INDEX IF NOT EXISTS idx_users_push_token
  ON users (push_token)
  WHERE push_token IS NOT NULL;
