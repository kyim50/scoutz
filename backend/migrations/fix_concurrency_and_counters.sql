-- ============================================================================
-- Move the RSVP capacity check and the user counters into the database.
--
-- Both were read-modify-write sequences in Node: the app read a value, decided
-- something, then wrote — with no lock in between. Under concurrency they lose
-- updates and let events exceed capacity. Neither can be fixed correctly in
-- application code; the check and the write have to happen atomically.
-- ============================================================================

-- ── Atomic RSVP ────────────────────────────────────────────────────────────
--
-- Locks the event row, re-counts confirmed attendees inside the lock, and only
-- then inserts. Returns the resulting attendee row.
--
-- Only 'going' consumes capacity — 'interested' is an expression of intent and
-- was previously (incorrectly) rejected on a full event. A user already going
-- can always change their own status, which the old check also blocked.
CREATE OR REPLACE FUNCTION rsvp_event(
  p_event_id UUID,
  p_user_id  UUID,
  p_status   TEXT
)
RETURNS event_attendees
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_going_count   INTEGER;
  v_already_going BOOLEAN;
  v_row           event_attendees;
BEGIN
  IF p_status NOT IN ('interested', 'going') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'check_violation';
  END IF;

  -- FOR UPDATE serialises concurrent RSVPs to the same event.
  SELECT max_attendees INTO v_max_attendees
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_attendees
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going'
  ) INTO v_already_going;

  IF p_status = 'going' AND v_max_attendees IS NOT NULL AND NOT v_already_going THEN
    SELECT COUNT(*) INTO v_going_count
    FROM event_attendees
    WHERE event_id = p_event_id AND status = 'going';

    IF v_going_count >= v_max_attendees THEN
      RAISE EXCEPTION 'EVENT_AT_CAPACITY' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO event_attendees (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, p_status)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
  RETURNING * INTO v_row;

  UPDATE events
  SET current_attendees = (
    SELECT COUNT(*) FROM event_attendees
    WHERE event_id = p_event_id AND status = 'going'
  )
  WHERE id = p_event_id;

  RETURN v_row;
END;
$$;

-- ── Atomic RSVP cancellation ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_rsvp(p_event_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  DELETE FROM event_attendees
  WHERE event_id = p_event_id AND user_id = p_user_id;

  UPDATE events
  SET current_attendees = (
    SELECT COUNT(*) FROM event_attendees
    WHERE event_id = p_event_id AND status = 'going'
  )
  WHERE id = p_event_id;
END;
$$;

-- ── Atomic user counters ───────────────────────────────────────────────────
--
-- Replaces SELECT-then-UPDATE in Node. `increment_user_pins_created` already
-- existed and was used; the events equivalent did not, so event creation lost
-- increments whenever two events were created at once.
CREATE OR REPLACE FUNCTION increment_user_events_created(uid UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE users SET events_created = COALESCE(events_created, 0) + 1 WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION increment_user_pins_created(uid UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE users SET pins_created = COALESCE(pins_created, 0) + 1 WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION decrement_user_pins_created(uid UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE users SET pins_created = GREATEST(COALESCE(pins_created, 0) - 1, 0) WHERE id = uid;
$$;

-- One RSVP row per user per event — required by the ON CONFLICT above and
-- assumed by the old upsert, which would silently duplicate without it.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_attendees_event_user
  ON event_attendees (event_id, user_id);

-- These are called by the backend as service_role only. Keep them off the
-- public API surface, consistent with enable_rls_lockdown.sql.
REVOKE ALL ON FUNCTION rsvp_event(UUID, UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION cancel_rsvp(UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION increment_user_events_created(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION increment_user_pins_created(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION decrement_user_pins_created(UUID) FROM anon, authenticated;
