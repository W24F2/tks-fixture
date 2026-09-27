// OPTIMIZED Sydney time helpers.
//
// NEW approach: formatter is module-level (constructed once). The previous
// code built Intl.DateTimeFormat per fixture per render pass (~100× cost).
// We compute "now" once in the caller and pass it to getFixtureStatusInSydney.
// event_end_time is now respected (instead of the hardcoded 3 h window only).

export const SYDNEY_TIMEZONE = 'Australia/Sydney';

// Module-level Intl formatter — constructing it is expensive; we reuse it.
const SYDNEY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SYDNEY_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Convert any instant to a Date whose local wall-clock fields equal Sydney time.
function toSydneyWallClock(date: Date): Date {
  const parts = SYDNEY_FORMATTER.formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
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
  fixture: { event_date: string; event_time?: string; event_end_time?: string; status?: string },
  now?: Date,
): 'upcoming' | 'live' | 'completed' | 'cancelled' {
  if (fixture.status === 'cancelled') return 'cancelled';
  if (fixture.status === 'completed') return 'completed';

  const current = now ?? getSydneyNow();
  const [y, m, d] = fixture.event_date.split('T')[0].split('-').map(Number);
  const [h, mi] = (fixture.event_time || '00:00').split(':').map(Number);
  const eventSydney = new Date(y, m - 1, d, h, mi, 0, 0);

  // Prefer an explicit end_time from the backend; fallback to 3h like before.
  let endSydney: Date;
  if (fixture.event_end_time) {
    const [eh, em] = fixture.event_end_time.split(':').map(Number);
    endSydney = new Date(y, m - 1, d, eh, em, 0, 0);
  } else {
    endSydney = new Date(eventSydney.getTime() + 3 * 60 * 60 * 1000);
  }

  if (current < eventSydney) return 'upcoming';
  if (current >= eventSydney && current <= endSydney) return 'live';
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
