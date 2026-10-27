import { APP_CONFIG } from '../../config/app';
import { addDaysToDateKey, isoWeekdayOfDateKey, zonedWallTimeToUtc } from '../../../shared/time';

export const CURATED_KEYWORDS = [
  'breakthrough',
  'serendipity',
  'wanderlust',
  'milestone',
  'brainstorm',
  'momentum',
  'storytelling',
  'resilience',
  'curiosity',
  'adventure',
  'kindness',
  'sparkle',
  'teamwork',
  'horizon',
  'gratitude',
  'pineapple',
  'sunflower',
  'coffeehouse',
  'harmony',
  'discovery',
  'trailblazer',
  'compass',
  'evergreen',
  'butterfly',
  'starlight',
  'moonlight',
  'thunderstorm',
  'waterfall',
  'campfire',
  'skyscraper',
] as const;

export function suggestRandomKeyword(usedLowerCompact: ReadonlySet<string>): string {
  const unused = CURATED_KEYWORDS.filter((w) => !usedLowerCompact.has(w.toLowerCase()));
  const pool = unused.length > 0 ? unused : CURATED_KEYWORDS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? 'momentum';
}

export interface GeneratedSessionCandidate {
  id: string;
  dateKey: string;
  weekday: number;
  startsAtMs: number;
  endsAtMs: number;
}

/**
 * Generates Tue/Thu session candidates for the next `weeks` weeks starting at `startDateKey`
 * (default 2026-10-27, 18:00–19:00 America/Sao_Paulo).
 */
export function generateTueThuCandidates(
  startDateKey: string = APP_CONFIG.DEFAULT_GENERATOR_START_DATE,
  weeks = 4,
  startTime = APP_CONFIG.DEFAULT_CLASS_START,
  endTime = APP_CONFIG.DEFAULT_CLASS_END,
): GeneratedSessionCandidate[] {
  const out: GeneratedSessionCandidate[] = [];
  const totalDays = Math.max(1, Math.min(26, weeks)) * 7;
  for (let d = 0; d < totalDays; d++) {
    const dateKey = addDaysToDateKey(startDateKey, d);
    const weekday = isoWeekdayOfDateKey(dateKey);
    if (APP_CONFIG.DEFAULT_CLASS_WEEKDAYS.includes(weekday)) {
      const startsAtMs = zonedWallTimeToUtc(dateKey, startTime, APP_CONFIG.TIMEZONE);
      const endsAtMs = zonedWallTimeToUtc(dateKey, endTime, APP_CONFIG.TIMEZONE);
      out.push({ id: dateKey, dateKey, weekday, startsAtMs, endsAtMs });
    }
  }
  return out;
}
