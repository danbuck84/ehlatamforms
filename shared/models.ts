/**
 * Firestore document shapes (see docs/DATA_MODEL.md).
 * Instants are Firestore Timestamps in the database; these types use a generic
 * `TS` so both the Admin SDK and the Web SDK Timestamp types fit.
 */
import type { KeywordMatch, Level, Rating, Role, Speaking, UiLanguage } from './constants';

export interface SessionDoc<TS = unknown> {
  startsAt: TS;
  endsAt: TS;
  timezone: string;
  title?: string | null;
  topic?: string | null;
  opensOffsetMin: number;
  closesOffsetMin: number;
  status: 'scheduled' | 'cancelled';
  requireKeyword: boolean;
  peakAudience: number | null;
  notes?: string | null;
  createdAt: TS;
  updatedAt: TS;
}

export interface SessionSecretDoc {
  keyword: string;
  fuzzy: boolean;
}

export interface CheckinDoc<TS = unknown> {
  sessionId: string;
  email: string;
  emailCanonical: string;
  emailDomain: string;
  country: string;
  role: Role | null;
  speaking: Speaking;
  level: Level | null;
  rating: Rating;
  comment: string | null;
  topicSuggestion: string | null;
  keywordMatch: KeywordMatch;
  uiLanguage: UiLanguage;
  isTeacher: boolean;
  late: boolean;
  clientSubmissionId: string;
  submittedAt: TS;
  appVersion: string;
}

export interface StudentDoc<TS = unknown> {
  firstSeenAt: TS;
  lastSeenAt: TS;
  totalCheckins: number;
  lastCountry: string;
  emailDomain: string;
  isTeacher: boolean;
}

export interface SessionStatsDoc {
  total: number;
  ratingSum: number;
  ratingCount: number;
  byCountry: Record<string, number>;
  bySpeaking: Record<string, number>;
  byLevel: Record<string, number>;
  byRole: Record<string, number>;
  byDomain: Record<string, number>;
}

export function emptyStats(): SessionStatsDoc {
  return {
    total: 0,
    ratingSum: 0,
    ratingCount: 0,
    byCountry: {},
    bySpeaking: {},
    byLevel: {},
    byRole: {},
    byDomain: {},
  };
}

/** Firestore map keys cannot contain "." safely in field paths; encode them. */
export function statsKey(value: string): string {
  return value.replace(/\./g, '\u2024'); // one dot leader
}
export function decodeStatsKey(value: string): string {
  return value.replace(/\u2024/g, '.');
}

/** Adds (delta = 1) or removes (delta = -1) one check-in from the stats (pure). */
export function applyCheckinToStats(
  stats: SessionStatsDoc,
  c: Pick<CheckinDoc, 'country' | 'speaking' | 'level' | 'role' | 'emailDomain' | 'rating'>,
  delta: 1 | -1,
): SessionStatsDoc {
  const bump = (m: Record<string, number>, key: string) => {
    const k = statsKey(key);
    const v = (m[k] ?? 0) + delta;
    const next = { ...m };
    if (v <= 0) delete next[k];
    else next[k] = v;
    return next;
  };
  return {
    total: Math.max(0, stats.total + delta),
    ratingSum: Math.max(0, stats.ratingSum + delta * c.rating),
    ratingCount: Math.max(0, stats.ratingCount + delta),
    byCountry: bump(stats.byCountry, c.country),
    bySpeaking: bump(stats.bySpeaking, c.speaking),
    byLevel: bump(stats.byLevel, c.level ?? 'none'),
    byRole: bump(stats.byRole, c.role ?? 'none'),
    byDomain: bump(stats.byDomain, c.emailDomain),
  };
}
