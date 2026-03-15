-- Fix: get_nearby_reports returned varchar(30) in column 4 (type) but RETURNS TABLE
-- declared it as TEXT. PostgreSQL plpgsql raises "structure of query does not match
-- function result type" at execution time. Add explicit ::TEXT cast.

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
    r.created_at::TIMESTAMP,
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
