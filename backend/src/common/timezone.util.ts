export function localToUTC(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(naive);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  const localYear = get('year');
  const localMonth = get('month');
  const localDay = get('day');
  let localHour = get('hour');
  const localMinute = get('minute');

  if (localHour === 24) localHour = 0;

  const displayedLocal = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, 0);
  const offset = naive.getTime() - displayedLocal;

  return new Date(naive.getTime() + offset);
}

export function shiftToUTCRange(
  date: string,
  startTime: string,
  endTime: string,
  timezone: string,
): { startUTC: Date; endUTC: Date } {
  const startUTC = localToUTC(date, startTime, timezone);
  let endUTC = localToUTC(date, endTime, timezone);

  if (endUTC.getTime() <= startUTC.getTime()) {
    endUTC = new Date(endUTC.getTime() + 24 * 60 * 60 * 1000);
  }

  return { startUTC, endUTC };
}

export function minutesBetween(startTime: string, endTime: string): number {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let diff = toMinutes(endTime) - toMinutes(startTime);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
