-- ============================================================
-- Groups feature
-- Allows users to create private groups and tag pins, events,
-- and reports so they are only visible to group members.
-- Filtering is enforced at query/RPC level using the caller's
-- internal users.id (not Supabase auth.uid).
-- ============================================================

-- ─── groups ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code VARCHAR(12) NOT NULL UNIQUE
                DEFAULT substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner  ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite ON groups(invite_code);

COMMENT ON TABLE  groups             IS 'User-created private groups for sharing content';
COMMENT ON COLUMN groups.invite_code IS 'Short alphanumeric code used to join via invite link';
COMMENT ON COLUMN groups.owner_id    IS 'Creator of the group; always present in group_members as owner';

-- ─── group_members ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_members (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID        NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members(user_id);

COMMENT ON TABLE  group_members      IS 'Membership records linking users to groups';
COMMENT ON COLUMN group_members.role IS 'owner = group creator with admin rights; member = regular member';

-- ─── Add group_id to content tables ──────────────────────────
-- NULL means public (default, existing behaviour unchanged).
-- Non-null means group-only: only members of that group see it.

ALTER TABLE pins    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Partial indexes: only index the minority of rows that are group-scoped
CREATE INDEX IF NOT EXISTS idx_pins_group    ON pins(group_id)    WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_group  ON events(group_id)  WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_group ON reports(group_id) WHERE group_id IS NOT NULL;

COMMENT ON COLUMN pins.group_id    IS 'NULL = public; set = visible only to members of this group';
COMMENT ON COLUMN events.group_id  IS 'NULL = public; set = visible only to members of this group';
COMMENT ON COLUMN reports.group_id IS 'NULL = public; set = visible only to members of this group';

-- ─── Helper: regenerate invite code (called by refreshInviteCode) ──

CREATE OR REPLACE FUNCTION refresh_group_invite_code(p_group_id UUID, p_owner_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  new_code VARCHAR;
BEGIN
  new_code := substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8);
  UPDATE groups
    SET invite_code = new_code
    WHERE id = p_group_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found or insufficient permissions';
  END IF;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ─── Helper function: get all group IDs a user belongs to ────
-- Used internally by the RPC functions below to avoid repeating
-- the membership subquery on every row.

CREATE OR REPLACE FUNCTION get_user_group_ids(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(group_id), '{}')
  FROM group_members
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_user_group_ids IS
  'Returns the array of group UUIDs the given user belongs to. '
  'Called once per nearby query and passed into the visibility check.';

-- ─── Updated get_nearby_pins ──────────────────────────────────
-- Adds p_user_id param. Public pins (group_id IS NULL) are always
-- returned. Group pins are returned only when p_user_id is a member.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'get_nearby_pins'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'search_nearby_pins'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_nearby_pins(
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 1000,
  pin_type      TEXT    DEFAULT NULL,
  limit_count   INTEGER DEFAULT 20,
  p_user_id     UUID    DEFAULT NULL
)
RETURNS TABLE (
  id                 UUID,
  user_id            UUID,
  group_id           UUID,
  pin_lat            DOUBLE PRECISION,
  pin_lng            DOUBLE PRECISION,
  type               TEXT,
  title              TEXT,
  description        TEXT,
  tags               TEXT[],
  building           TEXT,
  floor              TEXT,
  access_notes       TEXT,
  photo_urls         TEXT[],
  created_at         TIMESTAMP,
  verification_count BIGINT,
  distance_meters    DOUBLE PRECISION
) AS $$
DECLARE
  user_groups UUID[];
BEGIN
  -- Fetch once; reused in the visibility check for every row
  user_groups := CASE WHEN p_user_id IS NOT NULL
                      THEN get_user_group_ids(p_user_id)
                      ELSE '{}'::UUID[]
                 END;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.group_id,
    ST_Y(p.location::geometry)  AS pin_lat,
    ST_X(p.location::geometry)  AS pin_lng,
    p.type::TEXT,
    p.title::TEXT,
    p.description::TEXT,
    p.tags,
    p.building::TEXT,
    p.floor::TEXT,
    p.access_notes::TEXT,
    p.photo_urls,
    p.created_at::TIMESTAMP,
    COALESCE(COUNT(pv.pin_id), 0) AS verification_count,
    ST_Distance(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM pins p
  LEFT JOIN pin_verifications pv ON pv.pin_id = p.id AND pv.is_accurate = true
  WHERE ST_DWithin(
    p.location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  AND (pin_type IS NULL OR p.type = pin_type)
  AND (
    p.group_id IS NULL
    OR (p.group_id = ANY(user_groups))
  )
  GROUP BY p.id
  ORDER BY distance_meters
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ─── Updated get_upcoming_events ─────────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'get_upcoming_events'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_upcoming_events(
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000,
  hours_ahead   INTEGER DEFAULT 168,
  p_user_id     UUID    DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  user_id          UUID,
  group_id         UUID,
  event_lat        DOUBLE PRECISION,
  event_lng        DOUBLE PRECISION,
  title            TEXT,
  description      TEXT,
  category         TEXT,
  start_time       TIMESTAMP,
  end_time         TIMESTAMP,
  max_attendees    INTEGER,
  current_attendees INTEGER,
  tags             TEXT[],
  location_name    TEXT,
  building         TEXT,
  room             TEXT,
  status           TEXT,
  photo_url        TEXT,
  is_recurring     BOOLEAN,
  parent_event_id  UUID,
  created_at       TIMESTAMP,
  distance_meters  DOUBLE PRECISION,
  creator_name     TEXT,
  creator_avatar   TEXT
) AS $$
DECLARE
  user_groups UUID[];
BEGIN
  user_groups := CASE WHEN p_user_id IS NOT NULL
                      THEN get_user_group_ids(p_user_id)
                      ELSE '{}'::UUID[]
                 END;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.group_id,
    ST_Y(e.location::geometry)  AS event_lat,
    ST_X(e.location::geometry)  AS event_lng,
    e.title::TEXT,
    e.description::TEXT,
    e.category::TEXT,
    e.start_time::TIMESTAMP,
    e.end_time::TIMESTAMP,
    e.max_attendees,
    e.current_attendees,
    e.tags,
    e.location_name::TEXT,
    e.building::TEXT,
    e.room::TEXT,
    e.status::TEXT,
    e.photo_url::TEXT,
    e.is_recurring,
    e.parent_event_id,
    e.created_at::TIMESTAMP,
    ST_Distance(
      e.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters,
    u.name::TEXT       AS creator_name,
    u.avatar_url::TEXT AS creator_avatar
  FROM events e
  JOIN users u ON u.id = e.user_id
  WHERE ST_DWithin(
    e.location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  AND e.status = 'scheduled'
  AND e.end_time   > NOW()
  AND e.start_time < NOW() + (hours_ahead || ' hours')::interval
  AND (
    e.group_id IS NULL
    OR (e.group_id = ANY(user_groups))
  )
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql;

-- ─── Updated get_nearby_reports ──────────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc WHERE proname = 'get_nearby_reports'
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_nearby_reports(
  p_lat         FLOAT,
  p_lng         FLOAT,
  radius_meters INT  DEFAULT 500,
  report_type   TEXT DEFAULT NULL,
  limit_count   INT  DEFAULT 50,
  p_user_id     UUID DEFAULT NULL
)
RETURNS TABLE (
  id         UUID,
  user_id    UUID,
  group_id   UUID,
  type       TEXT,
  pin_id     UUID,
  content    TEXT,
  metadata   JSONB,
  created_at TIMESTAMP,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION
) AS $$
DECLARE
  user_groups UUID[];
BEGIN
  user_groups := CASE WHEN p_user_id IS NOT NULL
                      THEN get_user_group_ids(p_user_id)
                      ELSE '{}'::UUID[]
                 END;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.group_id,
    r.type::TEXT,
    r.pin_id,
    r.content,
    r.metadata,
    r.created_at,
    ST_Y(r.location::geometry)::DOUBLE PRECISION,
    ST_X(r.location::geometry)::DOUBLE PRECISION
  FROM reports r
  WHERE r.location IS NOT NULL
  AND ST_DWithin(
    r.location::geography,
    ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography,
    radius_meters
  )
  AND (report_type IS NULL OR r.type = report_type)
  AND (
    r.group_id IS NULL
    OR (r.group_id = ANY(user_groups))
  )
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
