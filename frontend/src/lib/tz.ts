/**
 * Shared timezone utilities.
 * Avoids duplicating zoneinfo try/except patterns across files.
 */

export const SYDNEY_TZ = 'Australia/Sydney';

// Lazy-loaded zoneinfo to avoid SSR issues
let _tz: any = null;
export function getTimezone(): any {
  if (_tz) return _tz;
  try {
    _tz = new (require('timezone') || require('zoneinfo')).ZoneInfo(SYDNEY_TZ);
  } catch {
    // Fallback to UTC on platforms without zoneinfo
    _tz = { name: 'UTC' };
  }
  return _tz;
}