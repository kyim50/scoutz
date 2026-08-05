/**
 * Guards around values that reach PostGIS or a PostgREST filter expression.
 */

import { assertValidCoordinates, clampRadius, parseCoordinates } from '../utils/coordinates';
import { assertUuid, AppError } from '../utils/errors';

describe('assertValidCoordinates', () => {
  it('accepts an ordinary coordinate pair', () => {
    expect(assertValidCoordinates(40.7128, -74.006)).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('accepts the extremes of both ranges', () => {
    expect(assertValidCoordinates(90, 180)).toEqual({ lat: 90, lng: 180 });
    expect(assertValidCoordinates(-90, -180)).toEqual({ lat: -90, lng: -180 });
  });

  it.each([
    ['latitude above range', 91, 0],
    ['latitude below range', -91, 0],
    ['longitude above range', 0, 181],
    ['longitude below range', 0, -181],
  ])('rejects %s', (_label, lat, lng) => {
    expect(() => assertValidCoordinates(lat, lng)).toThrow(AppError);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a string', '40.7'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s, which typeof-only checks let through', (_label, value) => {
    // The previous check was `typeof lat !== 'number'`, which accepts NaN and
    // Infinity — both reach PostGIS as a malformed POINT.
    expect(() => assertValidCoordinates(value, 0)).toThrow(AppError);
  });

  it('reports a 400 rather than a 500', () => {
    expect(() => assertValidCoordinates(999, 0)).toThrow(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe('parseCoordinates', () => {
  it('converts query-string values', () => {
    expect(parseCoordinates('40.7128', '-74.006')).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('rejects unparseable query values', () => {
    expect(() => parseCoordinates('north', '-74.006')).toThrow(AppError);
  });
});

describe('clampRadius', () => {
  it('falls back when the value is missing or nonsense', () => {
    expect(clampRadius(undefined, 500)).toBe(500);
    expect(clampRadius('abc', 500)).toBe(500);
    expect(clampRadius(-10, 500)).toBe(500);
    expect(clampRadius(0, 500)).toBe(500);
  });

  it('caps an unreasonably large radius', () => {
    // Without a ceiling, a caller can ask PostGIS to scan the whole table.
    expect(clampRadius(10_000_000, 500)).toBe(50_000);
  });

  it('passes a sensible radius through', () => {
    expect(clampRadius(1500, 500)).toBe(1500);
  });
});

describe('assertUuid', () => {
  it('accepts a well-formed uuid', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(assertUuid(id)).toBe(id);
  });

  it.each([
    ['a filter-injection payload', '00000000-0000-0000-0000-000000000000,status.eq.cancelled'],
    ['parentheses', 'abc(def)'],
    ['a bare word', 'unread'],
    ['an empty string', ''],
    ['a non-string', 42],
  ])('rejects %s', (_label, value) => {
    // These are interpolated into PostgREST `.or()` expressions, so anything
    // carrying a comma or parenthesis could restructure the query.
    expect(() => assertUuid(value)).toThrow(AppError);
  });
});
