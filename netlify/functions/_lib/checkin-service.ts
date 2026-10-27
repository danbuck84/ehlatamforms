import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { checkinRequestSchema, type CheckinError, type CheckinSuccess } from '../../../shared/schemas';
import { LIMITS } from '../../../shared/constants';
import { canonicalEmail, isBlockedDomain, splitEmail, suggestEmail } from '../../../shared/email';
import { matchKeyword } from '../../../shared/keyword';
import { acceptCheckin } from '../../../shared/window';
import { statsKey, type CheckinDoc, type SessionSecretDoc } from '../../../shared/models';
import { constantTimeEqual, sha256Hex } from './crypto';
import { hitRateLimit } from './rate-limit';
import { currentSessions, toLoaded, toPublicSession } from './sessions';
import type { AppCheckStatus } from './auth';
import type { MxResult } from './mx';
import type { AppCheckEnforcement } from './env';

export interface CheckinDeps {
  db: Firestore;
  nowMs: () => number;
  appCheckStatus: AppCheckStatus;
  appCheckEnforcement: AppCheckEnforcement;
  checkMx: (domain: string) => Promise<MxResult>;
  clientIp: string;
  adminEmails: string[];
  log: (event: string, data?: Record<string, string | number | boolean | null>) => void;
}

export interface ServiceResult {
  status: number;
  body: CheckinSuccess | CheckinError;
  headers?: Record<string, string>;
}

const fail = (status: number, body: CheckinError, headers?: Record<string, string>): ServiceResult => ({
  status,
  body,
  headers,
});

export function checkinDocId(sessionId: string, emailKey: string): string {
  return `${sessionId}__${emailKey}`;
}

export async function processCheckin(raw: unknown, deps: CheckinDeps): Promise<ServiceResult> {
  const { db } = deps;
  const now = deps.nowMs();

  // 1. Shape validation (unknown fields rejected).
  const parsed = checkinRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') || undefined;
    return fail(400, { error: 'validation', field });
  }
  const input = parsed.data;

  // 2. Bot heuristics: honeypot + minimum time to submit.
  if (input.website.trim() !== '' || input.elapsedMs < LIMITS.minTimeToSubmitMs) {
    deps.log('checkin_bot', { session: input.sessionId });
    return fail(400, { error: 'bot' });
  }

  // 3. App Check (soft: strict rate-limit tier instead of blocking).
  const appCheckOk = deps.appCheckStatus === 'valid' || deps.appCheckStatus === 'skipped';
  if (!appCheckOk) {
    deps.log('appcheck_failed', { status: deps.appCheckStatus, mode: deps.appCheckEnforcement });
    if (deps.appCheckEnforcement === 'strict') return fail(401, { error: 'bot' });
  }

  // 4. IP rate limit.
  const ipLimit = appCheckOk ? LIMITS.ipRequests : LIMITS.ipRequestsStrict;
  const ipRes = await hitRateLimit(db, `ip:${deps.clientIp}`, ipLimit, now);
  if (!ipRes.allowed) {
    return fail(429, { error: 'rate_limited', retryAfter: ipRes.retryAfterSec }, { 'Retry-After': String(ipRes.retryAfterSec) });
  }

  // 5. Email checks.
  const email = input.email;
  const { domain } = splitEmail(email);
  if (isBlockedDomain(domain)) {
    return fail(400, { error: 'email_blocked', field: 'email', suggestion: suggestEmail(email) ?? undefined });
  }
  const mx = await deps.checkMx(domain);
  if (mx === 'invalid') return fail(400, { error: 'email_domain_invalid', field: 'email' });
  const emailCanonical = canonicalEmail(email);
  const emailKey = sha256Hex(emailCanonical);

  // 6. Session + window.
  const sessionSnap = await db.collection('sessions').doc(input.sessionId).get();
  const session = toLoaded(sessionSnap);
  if (!session) return fail(404, { error: 'session_not_found' });
  const capturedAt = Date.parse(input.clientCapturedAt);
  const acceptance = acceptCheckin(session, now, capturedAt);
  if (!acceptance.ok) return fail(409, { error: acceptance.reason });

  // 7. Keyword (constant-time compare, wrong attempts rate-limited per email + session).
  let keywordMatch: CheckinDoc['keywordMatch'] = 'not_required';
  if (session.doc.requireKeyword !== false) {
    const kwKey = `kw:${input.sessionId}:${emailKey}`;
    const peek = await hitRateLimit(db, kwKey, LIMITS.wrongKeyword, now, { peek: true });
    if (!peek.allowed) {
      return fail(429, { error: 'rate_limited', retryAfter: peek.retryAfterSec }, { 'Retry-After': String(peek.retryAfterSec) });
    }
    if (!input.keyword.trim()) return fail(400, { error: 'keyword_required', field: 'keyword' });
    const secretSnap = await db.collection('sessionSecrets').doc(input.sessionId).get();
    const secret = secretSnap.data() as SessionSecretDoc | undefined;
    const match = secret?.keyword ? matchKeyword(input.keyword, secret.keyword, secret.fuzzy !== false, constantTimeEqual) : null;
    if (!match) {
      await hitRateLimit(db, kwKey, LIMITS.wrongKeyword, now);
      deps.log('checkin_keyword_wrong', { session: input.sessionId, configured: Boolean(secret?.keyword) });
      return fail(400, { error: 'keyword_wrong', field: 'keyword' });
    }
    keywordMatch = match;
  }

  // 8. Transactional create + student + stats.
  const isTeacher = deps.adminEmails.includes(email) || deps.adminEmails.map(canonicalEmail).includes(emailCanonical);
  const checkinRef = db.collection('checkins').doc(checkinDocId(input.sessionId, emailKey));
  const studentRef = db.collection('students').doc(emailKey);
  const statsRef = db.collection('sessionStats').doc(input.sessionId);
  const nowTs = Timestamp.fromMillis(now);

  const created = await db.runTransaction(async (tx) => {
    const [existing, student] = await Promise.all([tx.get(checkinRef), tx.get(studentRef)]);
    if (existing.exists) return false;

    const doc: CheckinDoc<Timestamp> = {
      sessionId: input.sessionId,
      email,
      emailCanonical,
      emailDomain: domain,
      country: input.country,
      role: input.role,
      speaking: input.speaking,
      level: input.level,
      rating: input.rating,
      comment: input.comment || null,
      topicSuggestion: input.topicSuggestion || null,
      keywordMatch,
      uiLanguage: input.uiLanguage,
      isTeacher,
      late: acceptance.late,
      clientSubmissionId: input.clientSubmissionId,
      submittedAt: nowTs,
      appVersion: input.appVersion,
    };
    tx.create(checkinRef, doc);

    if (student.exists) {
      tx.update(studentRef, {
        lastSeenAt: nowTs,
        totalCheckins: FieldValue.increment(1),
        lastCountry: input.country,
        emailDomain: domain,
        isTeacher,
      });
    } else {
      tx.set(studentRef, {
        firstSeenAt: nowTs,
        lastSeenAt: nowTs,
        totalCheckins: 1,
        lastCountry: input.country,
        emailDomain: domain,
        isTeacher,
      });
    }

    if (!isTeacher) {
      const inc = FieldValue.increment(1);
      tx.set(
        statsRef,
        {
          total: inc,
          ratingSum: FieldValue.increment(input.rating),
          ratingCount: inc,
          byCountry: { [statsKey(input.country)]: inc },
          bySpeaking: { [statsKey(input.speaking)]: inc },
          byLevel: { [statsKey(input.level ?? 'none')]: inc },
          byRole: { [statsKey(input.role ?? 'none')]: inc },
          byDomain: { [statsKey(domain)]: inc },
        },
        { merge: true },
      );
    }
    return true;
  });

  const { next } = await currentSessions(db, now);
  deps.log(created ? 'checkin_created' : 'checkin_duplicate', {
    session: input.sessionId,
    late: acceptance.late,
    match: keywordMatch,
    teacher: isTeacher,
  });
  return {
    status: created ? 201 : 200,
    body: {
      status: created ? 'created' : 'duplicate',
      sessionId: input.sessionId,
      late: acceptance.late,
      next: next ? toPublicSession(next) : null,
    },
  };
}
