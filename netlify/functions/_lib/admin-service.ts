import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { applyCheckinToStats, emptyStats, statsKey, type CheckinDoc, type SessionStatsDoc } from '../../../shared/models';

/** Deletes a check-in and keeps sessionStats and the student's counters consistent. */
export async function deleteCheckin(db: Firestore, checkinId: string): Promise<'deleted' | 'not_found'> {
  const ref = db.collection('checkins').doc(checkinId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'not_found';
    const c = snap.data() as CheckinDoc;
    const emailKey = checkinId.split('__')[1]!;
    const studentRef = db.collection('students').doc(emailKey);
    const statsRef = db.collection('sessionStats').doc(c.sessionId);
    const [student, stats] = await Promise.all([tx.get(studentRef), tx.get(statsRef)]);

    tx.delete(ref);
    if (student.exists) {
      const total = (student.get('totalCheckins') as number | undefined) ?? 0;
      if (total <= 1) tx.delete(studentRef);
      else tx.update(studentRef, { totalCheckins: FieldValue.increment(-1) });
    }
    if (!c.isTeacher && stats.exists) {
      const next = applyCheckinToStats({ ...emptyStats(), ...(stats.data() as Partial<SessionStatsDoc>) }, c, -1);
      tx.set(statsRef, next);
    }
    return 'deleted';
  });
}

/**
 * Rebuilds sessionStats from raw check-ins (one session, or all of them),
 * and — when rebuilding everything — the students' counters too.
 */
export async function recomputeStats(db: Firestore, sessionId?: string): Promise<{ sessions: number; checkins: number }> {
  const query = sessionId ? db.collection('checkins').where('sessionId', '==', sessionId) : db.collection('checkins');
  const snap = await query.get();
  const bySession = new Map<string, SessionStatsDoc>();
  const students = new Map<
    string,
    { firstSeenAt: FirebaseFirestore.Timestamp; lastSeenAt: FirebaseFirestore.Timestamp; totalCheckins: number; lastCountry: string; emailDomain: string; isTeacher: boolean }
  >();

  for (const d of snap.docs) {
    const c = d.data() as CheckinDoc<FirebaseFirestore.Timestamp>;
    if (!c.isTeacher) {
      bySession.set(c.sessionId, applyCheckinToStats(bySession.get(c.sessionId) ?? emptyStats(), c, 1));
    }
    const key = d.id.split('__')[1]!;
    const s = students.get(key);
    if (!s) {
      students.set(key, {
        firstSeenAt: c.submittedAt,
        lastSeenAt: c.submittedAt,
        totalCheckins: 1,
        lastCountry: c.country,
        emailDomain: c.emailDomain,
        isTeacher: c.isTeacher,
      });
    } else {
      s.totalCheckins++;
      if (c.submittedAt.toMillis() < s.firstSeenAt.toMillis()) s.firstSeenAt = c.submittedAt;
      if (c.submittedAt.toMillis() >= s.lastSeenAt.toMillis()) {
        s.lastSeenAt = c.submittedAt;
        s.lastCountry = c.country;
      }
    }
  }

  const writer = db.bulkWriter();
  const targetSessions = sessionId ? [sessionId] : (await db.collection('sessionStats').listDocuments()).map((r) => r.id);
  for (const id of new Set([...targetSessions, ...bySession.keys()])) {
    writer.set(db.collection('sessionStats').doc(id), bySession.get(id) ?? emptyStats());
  }
  if (!sessionId) {
    const existing = await db.collection('students').listDocuments();
    for (const ref of existing) if (!students.has(ref.id)) writer.delete(ref);
    for (const [id, s] of students) writer.set(db.collection('students').doc(id), s);
  }
  await writer.close();
  return { sessions: bySession.size, checkins: snap.size };
}

export { statsKey };
