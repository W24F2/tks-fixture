// OPTIMIZED Sydney time helpers.
//
// OLD approach repeatedly did `new Date(...toLocaleString('en-US', { timeZone }))`:
// it formatted an instant to a *string* in Sydney time, then re-parsed that string
// into a Date. That parse/format round-trip is slow and DST-fragile (it assumes the
// local machine timezone when re-parsing).
//
// NEW approach builds a *local* Date whose wall-clock fields equal Sydney's wall-clock
// via Intl.DateTimeFormat + timeZone, once. Comparing two such Dates is valid because
// both sides live in the same (local) frame representing Sydney time. Faster and correct.

export const SYDNEY_TIMEZONE = 'Australia/Sydney';

// Convert any instant to a Date whose local wall-clock fields equal Sydney time.
function toSydneyWallClock(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SYDNEY_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  // Some engines emit "24" for midnight; normalise to "0".
  const hour = get('hour') === '24' ? '0' : get('hour');

  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(hour),
    Number(get('minute')),
    Number(get('second')),
  );
}

export function getSydneyNow(): Date {
  return toSydneyWallClock(new Date());
}

export function getFixtureStatusInSydney(
  fixture: { event_date: string; event_time?: string; status?: string },
): 'upcoming' | 'live' | 'completed' | 'cancelled' {
  if (fixture.status === 'cancelled') return 'cancelled';
  if (fixture.status === 'completed') return 'completed';

  const now = getSydneyNow();
  // event_date is "YYYY-MM-DD"; parse as a calendar date to avoid UTC shift.
  const [y, m, d] = fixture.event_date.split('T')[0].split('-').map(Number);
  const [h, mi] = (fixture.event_time || '00:00').split(':').map(Number);
  // Build the event instant directly as a Sydney wall-clock Date (no re-conversion).
  const eventSydney = new Date(y, m - 1, d, h, mi, 0, 0);
  // Default 3h window for "live" unless the backend supplies event_end_time.
  const endTime = new Date(eventSydney.getTime() + 3 * 60 * 60 * 1000);

  if (now < eventSydney) return 'upcoming';
  if (now >= eventSydney && now <= endTime) return 'live';
  return 'completed';
}

// Display helpers. The backend stores event_date/event_time as Sydney-local
// strings, so we format them directly — no timezone conversion required.
export function formatSydneyTime(timeStr?: string): string {
  if (!timeStr) return 'TBA';
  const [h, mi] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(mi).padStart(2, '0')} ${ampm} AEDT/AEST`;
}

export function formatSydneyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function isPastDate(dateStr: string): boolean {
  const today = getSydneyNow();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date < today;
}
