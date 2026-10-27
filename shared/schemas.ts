import * as z from 'zod/mini';
import {
  COUNTRY_CODES,
  LEVELS,
  LIMITS,
  RATINGS,
  ROLES,
  SPEAKING,
  UI_LANGUAGES,
} from './constants';

export const SESSION_ID_PATTERN = /^\d{4}-\d{2}-\d{2}(-[a-z])?$/;

const optionalText = (max: number) =>
  z.nullable(z.string().check(z.trim(), z.maxLength(max)));

/** Body of POST /api/checkin. Unknown fields are rejected. */
export const checkinRequestSchema = z.strictObject({
  sessionId: z.string().check(z.regex(SESSION_ID_PATTERN)),
  email: z.string().check(z.trim(), z.toLowerCase(), z.minLength(3), z.maxLength(LIMITS.emailMax), z.email()),
  country: z.enum(COUNTRY_CODES),
  role: z.nullable(z.enum(ROLES)),
  speaking: z.enum(SPEAKING),
  level: z.nullable(z.enum(LEVELS)),
  rating: z.literal(RATINGS),
  keyword: z.string().check(z.maxLength(LIMITS.keywordMax)),
  comment: optionalText(LIMITS.commentMax),
  topicSuggestion: optionalText(LIMITS.topicMax),
  uiLanguage: z.enum(UI_LANGUAGES),
  clientSubmissionId: z.string().check(z.uuid()),
  clientCapturedAt: z.iso.datetime(),
  /** Milliseconds the student spent on the form (bot heuristic). */
  elapsedMs: z.number().check(z.int(), z.gte(0)),
  /** Honeypot: must be empty. */
  website: z.string().check(z.maxLength(200)),
  appVersion: z.string().check(z.maxLength(40)),
});
export type CheckinRequest = z.infer<typeof checkinRequestSchema>;

export const adminDeleteSchema = z.strictObject({
  checkinId: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}(-[a-z])?__[a-f0-9]{64}$/)),
});

export const adminRecomputeSchema = z.strictObject({
  sessionId: z.optional(z.string().check(z.regex(SESSION_ID_PATTERN))),
});

/** Public projection of a session (never contains the keyword). */
export interface PublicSession {
  id: string;
  startsAt: string;
  endsAt: string;
  opensAt: string;
  closesAt: string;
  timezone: string;
  title: string | null;
  topic: string | null;
  status: 'scheduled' | 'cancelled';
  requireKeyword: boolean;
}

export interface SessionsCurrentResponse {
  serverNow: string;
  open: PublicSession[];
  next: PublicSession | null;
}

export type CheckinErrorCode =
  | 'validation'
  | 'email_blocked'
  | 'email_domain_invalid'
  | 'keyword_required'
  | 'keyword_wrong'
  | 'not_yet_open'
  | 'closed'
  | 'cancelled'
  | 'session_not_found'
  | 'rate_limited'
  | 'bot'
  | 'server';

export interface CheckinSuccess {
  status: 'created' | 'duplicate';
  sessionId: string;
  late: boolean;
  next: PublicSession | null;
}

export interface CheckinError {
  error: CheckinErrorCode;
  field?: string;
  retryAfter?: number;
  suggestion?: string;
}
