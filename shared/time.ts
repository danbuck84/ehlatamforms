/**
 * Timezone helpers built only on Intl (no date library, see ADR 0003).
 * Instants are always epoch ms / ISO strings in UTC. Wall-clock values are
 * only produced for display or parsed from explicit (date, time, zone) triples.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  /** ISO weekday 1 = Monday … 7 = Sunday */
  weekday: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(ms))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS[out.weekday ?? 'Mon'] ?? 1,
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. BRT → -3 h. */
export function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/**
 * Converts a wall-clock date + time in `timeZone` to a UTC instant (epoch ms).
 * Never uses `new Date("YYYY-MM-DD HH:mm")`.
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): number {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) throw new Error('Invalid date or time');
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Two passes handle DST transitions correctly for zones that have them.
  const first = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(first, timeZone);
}

/** "2026-10-27" style date of an instant in the given zone. */
export function zonedDateKey(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "18:00" style time of an instant in the given zone. */
export function zonedTimeKey(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Adds whole days to a YYYY-MM-DD string (calendar arithmetic, zone-independent). */
export function addDaysToDateKey(date: string, days: number): string {
  const d = DATE_RE.exec(date);
  if (!d) throw new Error('Invalid date');
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]) + days);
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO weekday (1 = Mon … 7 = Sun) of a YYYY-MM-DD date. */
export function isoWeekdayOfDateKey(date: string): number {
  const d = DATE_RE.exec(date);
  if (!d) throw new Error('Invalid date');
  const wd = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))).getUTCDay();
  return wd === 0 ? 7 : wd;
}

const LOCALE_BY_LANG: Record<string, string> = { en: 'en-US', pt: 'pt-BR', es: 'es-419' };
export function localeFor(lang: string): string {
  return LOCALE_BY_LANG[lang] ?? 'en-US';
}

/** e.g. "Tue, Oct 27 · 6 PM" (EN), "ter., 27 de out. · 18:00" (PT). */
export function formatClassMoment(ms: number, lang: string, timeZone: string): string {
  const locale = localeFor(lang);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(ms);
  const p = getZonedParts(ms, timeZone);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    ...(p.minute !== 0 ? { minute: '2-digit' } : lang === 'en' ? {} : { minute: '2-digit' }),
  }).format(ms);
  return `${date} · ${time}`;
}

/** Long date + time, e.g. "Tuesday, October 27, 6:00 PM". */
export function formatLongMoment(ms: number, lang: string, timeZone: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms);
}

/** Time only, e.g. "12:00 PM" / "12:00". */
export function formatTime(ms: number, lang: string, timeZone: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { timeZone, hour: 'numeric', minute: '2-digit' }).format(ms);
}

/** Splits a duration into d/h/m/s parts for countdowns. */
export function splitDuration(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Device timezone or null when unavailable. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
