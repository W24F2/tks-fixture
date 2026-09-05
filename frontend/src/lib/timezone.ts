export const SYDNEY_TIMEZONE = 'Australia/Sydney';

export function getSydneyNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SYDNEY_TIMEZONE }));
}

export function toSydneyDate(date: Date): Date {
  const sydneyString = date.toLocaleString('en-US', { timeZone: SYDNEY_TIMEZONE });
  return new Date(sydneyString);
}

export function getFixtureStatusInSydney(fixture: { event_date: string; event_time?: string; status?: string }): 'upcoming' | 'live' | 'completed' | 'cancelled' {
  if (fixture.status === 'cancelled') return 'cancelled';
  if (fixture.status === 'completed') return 'completed';

  const now = getSydneyNow();
  const fixtureDateStr = fixture.event_date.split('T')[0];
  const fixtureTimeStr = fixture.event_time || '00:00';
  const [hours, minutes] = fixtureTimeStr.split(':').map(Number);
  
  const fixtureDate = new Date(fixtureDateStr);
  fixtureDate.setHours(hours, minutes, 0, 0);
  
  const fixtureSydney = toSydneyDate(fixtureDate);
  const endTime = new Date(fixtureSydney.getTime() + 3 * 60 * 60 * 1000);

  if (now < fixtureSydney) return 'upcoming';
  if (now >= fixtureSydney && now <= endTime) return 'live';
  return 'completed';
}

export function formatSydneyTime(timeStr?: string): string {
  if (!timeStr) return 'TBA';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  const sydneyDate = toSydneyDate(date);
  const h = sydneyDate.getHours();
  const m = sydneyDate.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${ampm} AEDT/AEST`;
}

export function formatSydneyDate(dateStr: string): string {
  const date = new Date(dateStr);
  const sydneyDate = toSydneyDate(date);
  return sydneyDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function isPastDate(dateStr: string): boolean {
  const today = getSydneyNow();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  return date < today;
}