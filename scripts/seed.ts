/**
 * Seeds the local Firestore emulator with an open session for today (18:00 BRT, 12h window)
 * and the next upcoming Tue/Thu session so `pnpm dev` works out of the box.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { APP_CONFIG } from '../src/config/app';
import { addDaysToDateKey, zonedDateKey, zonedWallTimeToUtc } from '../shared/time';
import { db } from '../netlify/functions/_lib/firebase';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID ??= 'demo-englishtalk';

async function main() {
  const firestore = db();
  const nowMs = Date.now();
  const todayKey = zonedDateKey(nowMs, APP_CONFIG.TIMEZONE);
  const startsAtMs = zonedWallTimeToUtc(todayKey, APP_CONFIG.DEFAULT_CLASS_START, APP_CONFIG.TIMEZONE);
  const endsAtMs = zonedWallTimeToUtc(todayKey, APP_CONFIG.DEFAULT_CLASS_END, APP_CONFIG.TIMEZONE);
  const nowTs = Timestamp.fromMillis(nowMs);

  await firestore.collection('sessions').doc(todayKey).set({
    startsAt: Timestamp.fromMillis(startsAtMs),
    endsAt: Timestamp.fromMillis(endsAtMs),
    timezone: APP_CONFIG.TIMEZONE,
    title: null,
    topic: 'Breaking the ice & daily tech routines',
    opensOffsetMin: APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN,
    closesOffsetMin: APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN,
    status: 'scheduled',
    requireKeyword: true,
    peakAudience: 22,
    notes: 'Seeded local session',
    createdAt: nowTs,
    updatedAt: nowTs,
  });

  await firestore.collection('sessionSecrets').doc(todayKey).set({
    keyword: 'trade-off',
    fuzzy: true,
    updatedAt: nowTs,
  });

  const nextKey = addDaysToDateKey(todayKey, 2);
  const nextStartsAtMs = zonedWallTimeToUtc(nextKey, APP_CONFIG.DEFAULT_CLASS_START, APP_CONFIG.TIMEZONE);
  const nextEndsAtMs = zonedWallTimeToUtc(nextKey, APP_CONFIG.DEFAULT_CLASS_END, APP_CONFIG.TIMEZONE);

  await firestore.collection('sessions').doc(nextKey).set({
    startsAt: Timestamp.fromMillis(nextStartsAtMs),
    endsAt: Timestamp.fromMillis(nextEndsAtMs),
    timezone: APP_CONFIG.TIMEZONE,
    title: null,
    topic: 'Working across Latin America',
    opensOffsetMin: APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN,
    closesOffsetMin: APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN,
    status: 'scheduled',
    requireKeyword: true,
    peakAudience: null,
    notes: null,
    createdAt: nowTs,
    updatedAt: nowTs,
  });

  await firestore.collection('sessionSecrets').doc(nextKey).set({
    keyword: 'momentum',
    fuzzy: true,
    updatedAt: nowTs,
  });

  console.log(`Seeded sessions ${todayKey} (keyword: "trade-off") and ${nextKey} (keyword: "momentum").`);
}

void main();
