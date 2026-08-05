-- ============================================================================
-- CRITICAL: Enable Row Level Security on every table.
--
-- The Supabase anon key is compiled into the mobile app bundle
-- (EXPO_PUBLIC_SUPABASE_ANON_KEY) and is therefore public — anyone can extract
-- it from a shipped build. With RLS disabled, that key grants full read AND
-- write access to every table through the PostgREST endpoint, completely
-- bypassing the Express API, its auth middleware, and its rate limits.
--
-- Verified before this migration: an anon-key GET on `users` returned rows, and
-- an anon-key PATCH on `users` returned 204 (write permitted).
--
-- This app routes all data access through the backend, which uses the
-- service_role key. service_role bypasses RLS entirely, so enabling RLS with
-- NO policies is exactly right: the API keeps working, direct client access
-- stops. Do not add permissive policies unless you deliberately move a feature
-- to direct-from-client Supabase access.
--
-- Run this in the Supabase SQL editor, then re-verify with:
--   curl "$SUPABASE_URL/rest/v1/users?select=id&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
-- Expect an empty array [] for reads and 401/403 for writes.
-- ============================================================================

ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_verifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_message_reads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_post_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_message_reads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful        ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_signups       ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER functions run as their owner and ignore the caller's RLS.
-- Revoke anon/authenticated EXECUTE so the RPCs cannot be used as a way around
-- the lockdown above. The backend calls them as service_role, which retains
-- access via its own grants.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_nearby_pins',
        'get_nearby_reports',
        'get_upcoming_events',
        'get_nearby_live_users',
        'get_event_lat_lng',
        'increment_user_pins_created',
        'increment_reputation',
        'refresh_group_invite_code'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated;', fn.sig);
  END LOOP;
END $$;
