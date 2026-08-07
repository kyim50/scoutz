export interface Point {
  lat: number;
  lng: number;
}

/**
 * Reads a lat/lng out of whatever PostgREST hands back for a PostGIS column.
 *
 * `select('*')` on a geography column returns hex EWKB — a string like
 * "0101000020E6100000..." — not GeoJSON and not WKT. Endpoints that go through
 * the ST_Y/ST_X RPCs get real numbers, but the plain table selects behind the
 * per-user lists do not, so every row arrived with a location the client had no
 * way to read. Decoding it here means those endpoints can return coordinates
 * without a migration and without teaching each screen a new shape.
 *
 * Also accepts GeoJSON, WKT and plain objects, since the same rows reach here
 * from RPCs and from optimistic client payloads.
 */
export function extractPoint(location: unknown): Point | null {
  if (location == null) return null;

  if (typeof location === 'object') {
    const obj = location as Record<string, any>;

    // GeoJSON: { type: 'Point', coordinates: [lng, lat] }
    if (obj.type === 'Point' && Array.isArray(obj.coordinates)) {
      return validate(Number(obj.coordinates[1]), Number(obj.coordinates[0]));
    }
    const lat = obj.lat ?? obj.latitude;
    const lng = obj.lng ?? obj.longitude;
    if (lat != null && lng != null) return validate(Number(lat), Number(lng));
    return null;
  }

  if (typeof location !== 'string') return null;

  // WKT, with or without an SRID prefix.
  const wkt = location.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (wkt) return validate(Number(wkt[2]), Number(wkt[1]));

  return pointFromEWKB(location);
}

/** Hex EWKB for a 2D point, either byte order, with or without an SRID. */
function pointFromEWKB(hex: string): Point | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;

  try {
    const buf = Buffer.from(hex, 'hex');
    if (buf.length < 21) return null;

    const little = buf.readUInt8(0) === 1;
    const readU32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    const readF64 = (o: number) => (little ? buf.readDoubleLE(o) : buf.readDoubleBE(o));

    const typeWord = readU32(1);
    // Low bits carry the geometry type; the high bits are Z/M/SRID flags.
    if ((typeWord & 0x0fffffff) !== 1) return null;

    const hasSrid = (typeWord & 0x20000000) !== 0;
    const offset = hasSrid ? 9 : 5;
    if (buf.length < offset + 16) return null;

    // EWKB stores X then Y, which is longitude then latitude.
    return validate(readF64(offset + 8), readF64(offset));
  } catch {
    return null;
  }
}

function validate(lat: number, lng: number): Point | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Adds flat `lat`/`lng` to a row, leaving anything already there alone —
 * RPC-backed rows arrive with the coordinates spelled differently.
 */
export function withCoordinates<T extends Record<string, any>>(row: T): T & Partial<Point> {
  if (typeof row?.lat === 'number' && typeof row?.lng === 'number') return row;

  const existing =
    typeof row?.pin_lat === 'number'
      ? { lat: row.pin_lat, lng: row.pin_lng }
      : typeof row?.event_lat === 'number'
        ? { lat: row.event_lat, lng: row.event_lng }
        : null;

  const point = existing ?? extractPoint(row?.location);
  return point ? { ...row, lat: point.lat, lng: point.lng } : row;
}
