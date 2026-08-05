import { badRequest } from './errors';

/**
 * Validate a latitude/longitude pair.
 *
 * Callers previously only checked `typeof x === 'number'`, which accepts NaN,
 * Infinity, and out-of-range values. Those reach PostGIS as a malformed POINT
 * and either fail deep in the query or store a location that no radius search
 * will ever match.
 */
export function assertValidCoordinates(lat: unknown, lng: unknown): { lat: number; lng: number } {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw badRequest('Latitude must be a number between -90 and 90');
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw badRequest('Longitude must be a number between -180 and 180');
  }
  return { lat, lng };
}

/** Parse and validate coordinates arriving as query-string values. */
export function parseCoordinates(latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } {
  return assertValidCoordinates(Number(latRaw), Number(lngRaw));
}

/** Clamp a requested search radius to something the database can answer quickly. */
export function clampRadius(radius: unknown, fallback: number, max = 50_000): number {
  const value = Number(radius);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.round(value), max);
}
