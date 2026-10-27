import { Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { computeWindow, selectCurrent, type WindowInput } from '../../../shared/window';
import { WINDOW_DEFAULTS, TIMEZONE } from '../../../shared/constants';
import type { PublicSession } from '../../../shared/schemas';
import type { SessionDoc } from '../../../shared/models';

export interface LoadedSession extends WindowInput {
  id: string;
  doc: SessionDoc<Timestamp>;
}

/** Window offsets are capped at 2 days in the admin UI, so this lookback is enough. */
const LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000 + 60_000;
const LOOKAHEAD_LIMIT = 40;

export function toLoaded(snap: DocumentSnapshot): LoadedSession | null {
  const doc = snap.data() as SessionDoc<Timestamp> | undefined;
  if (!doc || !(doc.startsAt instanceof Timestamp)) return null;
  return {
    id: snap.id,
    doc,
    startsAtMs: doc.startsAt.toMillis(),
    opensOffsetMin: doc.opensOffsetMin ?? WINDOW_DEFAULTS.opensOffsetMin,
    closesOffsetMin: doc.closesOffsetMin ?? WINDOW_DEFAULTS.closesOffsetMin,
    status: doc.status === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}

export function toPublicSession(s: LoadedSession): PublicSession {
  const w = computeWindow(s);
  return {
    id: s.id,
    startsAt: new Date(s.startsAtMs).toISOString(),
    endsAt: (s.doc.endsAt instanceof Timestamp ? s.doc.endsAt.toDate() : new Date(s.startsAtMs + 3600_000)).toISOString(),
    opensAt: new Date(w.opensAtMs).toISOString(),
    closesAt: new Date(w.closesAtMs).toISOString(),
    timezone: s.doc.timezone || TIMEZONE,
    title: s.doc.title ?? null,
    topic: s.doc.topic ?? null,
    status: s.status,
    requireKeyword: s.doc.requireKeyword !== false,
  };
}

/** Sessions around "now" (recent past + upcoming), oldest first. */
export async function loadCandidateSessions(firestore: Firestore, nowMs: number): Promise<LoadedSession[]> {
  const snap = await firestore
    .collection('sessions')
    .where('startsAt', '>=', Timestamp.fromMillis(nowMs - LOOKBACK_MS))
    .orderBy('startsAt', 'asc')
    .limit(LOOKAHEAD_LIMIT)
    .get();
  return snap.docs.map(toLoaded).filter((s): s is LoadedSession => s !== null);
}

export async function currentSessions(
  firestore: Firestore,
  nowMs: number,
): Promise<{ open: LoadedSession[]; next: LoadedSession | null }> {
  return selectCurrent(await loadCandidateSessions(firestore, nowMs), nowMs);
}
