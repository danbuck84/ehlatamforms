import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp as ClientTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db as getAdminDb } from '../../netlify/functions/_lib/firebase';
import { currentSessions, toPublicSession } from '../../netlify/functions/_lib/sessions';
import { processCheckin, type CheckinDeps } from '../../netlify/functions/_lib/checkin-service';
import { deleteCheckin, recomputeStats } from '../../netlify/functions/_lib/admin-service';
import { zonedWallTimeToUtc } from '../../shared/time';

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(here, '../firestore.rules');

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID = 'demo-englishtalk';
process.env.ADMIN_EMAILS = 'daniel.buck@rocketseat.team';
process.env.HASH_PEPPER = 'test-pepper-secret';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-englishtalk',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(rulesPath, 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Security Rules (deny-by-default & admin allowlist)', () => {
  const validSessionData = () => {
    const startMs = zonedWallTimeToUtc('2026-10-27', '18:00', 'America/Sao_Paulo');
    const endMs = zonedWallTimeToUtc('2026-10-27', '19:00', 'America/Sao_Paulo');
    return {
      startsAt: ClientTimestamp.fromMillis(startMs),
      endsAt: ClientTimestamp.fromMillis(endMs),
      timezone: 'America/Sao_Paulo',
      opensOffsetMin: 360,
      closesOffsetMin: 360,
      status: 'scheduled',
      requireKeyword: true,
      peakAudience: null,
      topic: 'AI in daily work',
    };
  };

  it('denies unauthenticated reads and writes across all collections', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'sessions', '2026-10-27')));
    await assertFails(getDoc(doc(anon, 'sessionSecrets', '2026-10-27')));
    await assertFails(getDoc(doc(anon, 'checkins', '2026-10-27__abc')));
    await assertFails(setDoc(doc(anon, 'sessions', '2026-10-27'), validSessionData()));
    await assertFails(setDoc(doc(anon, 'checkins', '2026-10-27__abc'), { email: 'a@b.com' }));
  });

  it('denies non-admin or unverified authenticated users', async () => {
    const nonAdmin = testEnv
      .authenticatedContext('user-1', { email: 'student@gmail.com', email_verified: true })
      .firestore();
    await assertFails(getDoc(doc(nonAdmin, 'sessions', '2026-10-27')));
    await assertFails(setDoc(doc(nonAdmin, 'sessions', '2026-10-27'), validSessionData()));

    const unverifiedAdmin = testEnv
      .authenticatedContext('admin-unverified', {
        email: 'daniel.buck@rocketseat.team',
        email_verified: false,
      })
      .firestore();
    await assertFails(getDoc(doc(unverifiedAdmin, 'sessions', '2026-10-27')));
    await assertFails(setDoc(doc(unverifiedAdmin, 'sessions', '2026-10-27'), validSessionData()));
  });

  it('allows verified admin to read all collections and write valid sessions & sessionSecrets only', async () => {
    const admin = testEnv
      .authenticatedContext('teacher-dan', {
        email: 'daniel.buck@rocketseat.team',
        email_verified: true,
      })
      .firestore();

    await assertSucceeds(setDoc(doc(admin, 'sessions', '2026-10-27'), validSessionData()));
    await assertSucceeds(
      setDoc(doc(admin, 'sessionSecrets', '2026-10-27'), { keyword: 'trade-off', fuzzy: true }),
    );
    await assertSucceeds(getDoc(doc(admin, 'sessions', '2026-10-27')));
    await assertSucceeds(getDoc(doc(admin, 'sessionSecrets', '2026-10-27')));
    await assertSucceeds(getDoc(doc(admin, 'sessionStats', '2026-10-27')));

    // Even admin cannot write directly to checkins, students, sessionStats, or rateLimits from the client
    await assertFails(setDoc(doc(admin, 'checkins', '2026-10-27__abc'), { sessionId: '2026-10-27' }));
    await assertFails(setDoc(doc(admin, 'students', 'abc'), { totalCheckins: 1 }));
    await assertFails(setDoc(doc(admin, 'sessionStats', '2026-10-27'), { total: 99 }));
    await assertFails(setDoc(doc(admin, 'rateLimits', 'k1'), { count: 1 }));
  });
});

describe('Netlify Functions & Check-in Service on the Emulator', () => {
  const sessionId = '2026-10-27';
  const startsAtMs = zonedWallTimeToUtc('2026-10-27', '18:00', 'America/Sao_Paulo');
  const endsAtMs = zonedWallTimeToUtc('2026-10-27', '19:00', 'America/Sao_Paulo');
  const openNowMs = zonedWallTimeToUtc('2026-10-27', '18:30', 'America/Sao_Paulo');

  async function seedSession(opts?: { status?: 'scheduled' | 'cancelled'; keyword?: string; fuzzy?: boolean }) {
    const firestore = getAdminDb();
    const nowTs = AdminTimestamp.fromMillis(openNowMs);
    await firestore.collection('sessions').doc(sessionId).set({
      startsAt: AdminTimestamp.fromMillis(startsAtMs),
      endsAt: AdminTimestamp.fromMillis(endsAtMs),
      timezone: 'America/Sao_Paulo',
      topic: 'Remote communication',
      opensOffsetMin: 360, // 12:00 BRT
      closesOffsetMin: 360, // 00:00 BRT Wed
      status: opts?.status ?? 'scheduled',
      requireKeyword: true,
      peakAudience: 25,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
    await firestore.collection('sessionSecrets').doc(sessionId).set({
      keyword: opts?.keyword ?? 'trade-off',
      fuzzy: opts?.fuzzy ?? true,
      updatedAt: nowTs,
    });
  }

  function baseDeps(overrides: Partial<CheckinDeps> = {}): CheckinDeps {
    return {
      db: getAdminDb(),
      nowMs: () => openNowMs,
      appCheckStatus: 'valid',
      appCheckEnforcement: 'soft',
      checkMx: async () => 'ok',
      clientIp: '203.0.113.10',
      adminEmails: ['daniel.buck@rocketseat.team'],
      log: () => undefined,
      ...overrides,
    };
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      sessionId,
      email: 'maria.silva@gmail.com',
      country: 'BR',
      role: 'rocketseat_student',
      speaking: 'a_lot',
      level: 'just_right',
      rating: 5,
      keyword: 'TRADE-OFF',
      comment: 'Loved the breakout room!',
      topicSuggestion: 'Travel stories',
      uiLanguage: 'pt',
      clientSubmissionId: '3e18f69f-521d-4d9e-ac8a-086e07587d14',
      clientCapturedAt: new Date(openNowMs).toISOString(),
      elapsedMs: 12_000,
      website: '',
      appVersion: '0.1.0',
      ...overrides,
    };
  }

  it('returns open and next sessions without leaking the secret keyword', async () => {
    await seedSession();
    const firestore = getAdminDb();
    const { open, next } = await currentSessions(firestore, openNowMs);
    expect(open).toHaveLength(1);
    expect(next).toBeNull();
    const pub = toPublicSession(open[0]!);
    expect(pub.id).toBe(sessionId);
    expect(pub.opensAt).toBe('2026-10-27T15:00:00.000Z'); // 12:00 BRT
    expect(pub.closesAt).toBe('2026-10-28T03:00:00.000Z'); // 00:00 BRT Wed
    expect(JSON.stringify(pub)).not.toContain('trade-off');
  });

  it('creates a valid check-in, updates stats transactionally, and treats Gmail dot/+tag duplicates idempotently', async () => {
    await seedSession();
    const first = await processCheckin(basePayload(), baseDeps());
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: 'created', sessionId, late: false });

    // Second submission with Gmail dots/+tag variation -> 200 duplicate
    const dup = await processCheckin(
      basePayload({
        email: 'mariasilva+second@googlemail.com',
        clientSubmissionId: '9b9b9b9b-521d-4d9e-ac8a-086e07587d14',
      }),
      baseDeps(),
    );
    expect(dup.status).toBe(200);
    expect(dup.body).toMatchObject({ status: 'duplicate', sessionId });

    // Stats only counted once
    const statsSnap = await getAdminDb().collection('sessionStats').doc(sessionId).get();
    expect(statsSnap.data()?.total).toBe(1);
    expect(statsSnap.data()?.ratingSum).toBe(5);
  });

  it('accepts fuzzy 1-typo keywords and rate-limits after 5 wrong keyword attempts', async () => {
    await seedSession({ keyword: 'breakthrough', fuzzy: true });
    // Fuzzy match (1 char missing: "breakthrugh")
    const fuzzyRes = await processCheckin(
      basePayload({ email: 'ana@gmail.com', keyword: 'breakthrugh' }),
      baseDeps(),
    );
    expect(fuzzyRes.status).toBe(201);

    // 5 wrong attempts for another student -> 400 keyword_wrong, 6th -> 429 rate_limited
    for (let i = 1; i <= 5; i++) {
      const r = await processCheckin(
        basePayload({ email: 'carlos@gmail.com', keyword: `wrong-${i}` }),
        baseDeps(),
      );
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: 'keyword_wrong' });
    }
    const sixth = await processCheckin(
      basePayload({ email: 'carlos@gmail.com', keyword: 'wrong-6' }),
      baseDeps(),
    );
    expect(sixth.status).toBe(429);
    expect(sixth.body).toMatchObject({ error: 'rate_limited' });
  });

  it('enforces not_yet_open, closed, cancelled, and 48h offline late grace rules', async () => {
    await seedSession();
    const beforeOpenMs = zonedWallTimeToUtc('2026-10-27', '11:59', 'America/Sao_Paulo');
    const notOpenRes = await processCheckin(
      basePayload({ clientCapturedAt: new Date(beforeOpenMs).toISOString() }),
      baseDeps({ nowMs: () => beforeOpenMs }),
    );
    expect(notOpenRes.status).toBe(409);
    expect(notOpenRes.body).toMatchObject({ error: 'not_yet_open' });

    const afterCloseMs = zonedWallTimeToUtc('2026-10-28', '00:05', 'America/Sao_Paulo');
    const closedRes = await processCheckin(
      basePayload({ clientCapturedAt: new Date(afterCloseMs).toISOString() }),
      baseDeps({ nowMs: () => afterCloseMs }),
    );
    expect(closedRes.status).toBe(409);
    expect(closedRes.body).toMatchObject({ error: 'closed' });

    // Offline submission captured at 18:30 BRT inside the window, delivered at 00:05 BRT -> accepted as late=true
    const lateRes = await processCheckin(
      basePayload({
        email: 'offline@gmail.com',
        clientCapturedAt: new Date(openNowMs).toISOString(),
      }),
      baseDeps({ nowMs: () => afterCloseMs }),
    );
    expect(lateRes.status).toBe(201);
    expect(lateRes.body).toMatchObject({ status: 'created', late: true });
  });

  it('flags teacher check-in with isTeacher=true and excludes it from sessionStats', async () => {
    await seedSession();
    const res = await processCheckin(
      basePayload({ email: 'daniel.buck@rocketseat.team' }),
      baseDeps(),
    );
    expect(res.status).toBe(201);
    const statsSnap = await getAdminDb().collection('sessionStats').doc(sessionId).get();
    expect(statsSnap.exists).toBe(false);
  });

  it('deletes a check-in and recomputes stats accurately', async () => {
    await seedSession();
    await processCheckin(basePayload({ email: 's1@gmail.com', rating: 4 }), baseDeps());
    await processCheckin(basePayload({ email: 's2@gmail.com', rating: 5 }), baseDeps());

    const checkinsSnap = await getAdminDb().collection('checkins').get();
    expect(checkinsSnap.size).toBe(2);
    const firstId = checkinsSnap.docs[0]!.id;

    const delStatus = await deleteCheckin(getAdminDb(), firstId);
    expect(delStatus).toBe('deleted');

    const statsAfterDel = await getAdminDb().collection('sessionStats').doc(sessionId).get();
    expect(statsAfterDel.data()?.total).toBe(1);

    const recomputed = await recomputeStats(getAdminDb());
    expect(recomputed.checkins).toBe(1);
    const statsAfterRecompute = await getAdminDb().collection('sessionStats').doc(sessionId).get();
    expect(statsAfterRecompute.data()?.total).toBe(1);
  });
});
