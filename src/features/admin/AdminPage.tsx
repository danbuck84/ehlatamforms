import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { APP_CONFIG } from '../../config/app';
import { toCsv } from '../../../shared/csv';
import { flagEmoji } from '../../../shared/country';
import { compactKeyword } from '../../../shared/keyword';
import {
  decodeStatsKey,
  emptyStats,
  type CheckinDoc,
  type SessionDoc,
  type SessionSecretDoc,
  type SessionStatsDoc,
  type StudentDoc,
} from '../../../shared/models';
import { zonedDateKey, zonedTimeKey, zonedWallTimeToUtc } from '../../../shared/time';
import { isOpenAt } from '../../../shared/window';
import { ALLOWED_ADMIN_EMAILS, getClientFirebase } from './firebase-client';
import { generateTueThuCandidates, suggestRandomKeyword } from './keywords';
import { LiveView } from './LiveView';

const ShareScreen = lazy(() => import('./ShareScreen').then((m) => ({ default: m.ShareScreen })));
const TrendChart = lazy(() => import('./TrendChart').then((m) => ({ default: m.TrendChart })));

const SPEAKING_LABELS: Record<string, string> = {
  a_lot: 'Spoke a lot',
  a_little: 'Spoke a little',
  chat_only: 'Chat only',
  listened: 'Only listened',
};

const LEVEL_LABELS: Record<string, string> = {
  too_easy: 'Too easy',
  a_bit_easy: 'A bit easy',
  just_right: 'Just right',
  a_bit_hard: 'A bit hard',
  too_hard: 'Too hard',
  none: 'Unanswered',
};

const ROLE_LABELS: Record<string, string> = {
  rocketseat_student: 'Rocketseat student',
  digital_house_student: 'Digital House student',
  dhrs_team: 'DH / Rocketseat team',
  other: 'Other / Ally',
  none: 'Unanswered',
};

type AdminTab = 'sessions' | 'live' | 'metrics' | 'share';

interface SessionRow {
  id: string;
  doc: SessionDoc<Timestamp>;
  secret?: SessionSecretDoc;
  stats: SessionStatsDoc;
}

interface CheckinRow {
  id: string;
  doc: CheckinDoc<Timestamp>;
}

export default function AdminPage() {
  const { auth, db } = useMemo(() => getClientFirebase(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);
  const [emailLinkAddress, setEmailLinkAddress] = useState('');
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>('sessions');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [studentsCount, setStudentsCount] = useState({ total: 0, returning: 0 });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [metricsSessionId, setMetricsSessionId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Create / edit session form state
  const [formSessionId, setFormSessionId] = useState<string>(APP_CONFIG.DEFAULT_GENERATOR_START_DATE);
  const [formDate, setFormDate] = useState<string>(APP_CONFIG.DEFAULT_GENERATOR_START_DATE);
  const [formStartTime, setFormStartTime] = useState<string>(APP_CONFIG.DEFAULT_CLASS_START);
  const [formEndTime, setFormEndTime] = useState<string>(APP_CONFIG.DEFAULT_CLASS_END);
  const [formTopic, setFormTopic] = useState('');
  const [formOpensOffset, setFormOpensOffset] = useState<number>(APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN);
  const [formClosesOffset, setFormClosesOffset] = useState<number>(APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN);
  const [formRequireKeyword, setFormRequireKeyword] = useState(true);
  const [formKeyword, setFormKeyword] = useState('');
  const [formFuzzy, setFormFuzzy] = useState(true);
  const [formPeakAudience, setFormPeakAudience] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'scheduled' | 'cancelled'>('scheduled');
  const [formNotes, setFormNotes] = useState('');

  // Generator state
  const [genStartDate, setGenStartDate] = useState<string>(APP_CONFIG.DEFAULT_GENERATOR_START_DATE);
  const [genWeeks, setGenWeeks] = useState(4);
  const [genDeselected, setGenDeselected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem('englishtalk:adminEmailForSignIn') ?? '';
      if (storedEmail) {
        void signInWithEmailLink(auth, storedEmail, window.location.href).then(() => {
          window.localStorage.removeItem('englishtalk:adminEmailForSignIn');
        });
      }
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const email = (u.email ?? '').trim().toLowerCase();
        if (!u.emailVerified || !ALLOWED_ADMIN_EMAILS.includes(email)) {
          setUnauthorizedEmail(u.email ?? 'unknown');
          setUser(null);
          void signOut(auth);
        } else {
          setUnauthorizedEmail(null);
          setUser(u);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [auth]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [sessSnap, secSnap, statsSnap, checkinsSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'sessions'), orderBy('startsAt', 'desc'))),
        getDocs(collection(db, 'sessionSecrets')),
        getDocs(collection(db, 'sessionStats')),
        getDocs(query(collection(db, 'checkins'), orderBy('submittedAt', 'desc'))),
        getDocs(collection(db, 'students')),
      ]);

      const secretsMap = new Map<string, SessionSecretDoc>();
      secSnap.forEach((d) => secretsMap.set(d.id, d.data() as SessionSecretDoc));

      const statsMap = new Map<string, SessionStatsDoc>();
      statsSnap.forEach((d) =>
        statsMap.set(d.id, { ...emptyStats(), ...(d.data() as Partial<SessionStatsDoc>) }),
      );

      const rows: SessionRow[] = sessSnap.docs.map((d) => ({
        id: d.id,
        doc: d.data() as SessionDoc<Timestamp>,
        secret: secretsMap.get(d.id),
        stats: statsMap.get(d.id) ?? emptyStats(),
      }));

      setSessions(rows);
      setSelectedSessionId((prev) => prev ?? rows[0]?.id ?? null);
      setMetricsSessionId(
        (prev) => prev ?? rows.find((r) => r.stats.total > 0)?.id ?? rows[0]?.id ?? null,
      );

      setCheckins(checkinsSnap.docs.map((d) => ({ id: d.id, doc: d.data() as CheckinDoc<Timestamp> })));

      let totalStudents = 0;
      let returningStudents = 0;
      studentsSnap.forEach((d) => {
        const st = d.data() as StudentDoc<Timestamp>;
        if (!st.isTeacher) {
          totalStudents++;
          if (st.totalCheckins > 1) returningStudents++;
        }
      });
      setStudentsCount({ total: totalStudents, returning: returningStudents });
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, [db]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      void loadAllAdminData();
    }, 0);
    return () => clearTimeout(t);
  }, [user, loadAllAdminData]);

  const usedKeywordsMap = useMemo(() => {
    const map = new Map<string, string>(); // compactKeyword -> sessionId
    for (const s of sessions) {
      if (s.secret?.keyword) {
        map.set(compactKeyword(s.secret.keyword), s.id);
      }
    }
    return map;
  }, [sessions]);

  const duplicateKeywordSession = useMemo(() => {
    const k = compactKeyword(formKeyword);
    if (!k) return null;
    const owner = usedKeywordsMap.get(k);
    return owner && owner !== formSessionId ? owner : null;
  }, [formKeyword, formSessionId, usedKeywordsMap]);

  const populateFormFromSession = (row: SessionRow) => {
    const startsAtMs = row.doc.startsAt.toMillis();
    const endsAtMs = row.doc.endsAt.toMillis();
    setFormSessionId(row.id);
    setFormDate(zonedDateKey(startsAtMs, APP_CONFIG.TIMEZONE));
    setFormStartTime(zonedTimeKey(startsAtMs, APP_CONFIG.TIMEZONE));
    setFormEndTime(zonedTimeKey(endsAtMs, APP_CONFIG.TIMEZONE));
    setFormTopic(row.doc.topic ?? '');
    setFormOpensOffset(row.doc.opensOffsetMin ?? APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN);
    setFormClosesOffset(row.doc.closesOffsetMin ?? APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN);
    setFormRequireKeyword(row.doc.requireKeyword !== false);
    setFormKeyword(row.secret?.keyword ?? '');
    setFormFuzzy(row.secret?.fuzzy !== false);
    setFormPeakAudience(row.doc.peakAudience != null ? String(row.doc.peakAudience) : '');
    setFormStatus(row.doc.status);
    setFormNotes(row.doc.notes ?? '');
    setSelectedSessionId(row.id);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const startsAtMs = zonedWallTimeToUtc(formDate, formStartTime, APP_CONFIG.TIMEZONE);
    const endsAtMs = zonedWallTimeToUtc(formDate, formEndTime, APP_CONFIG.TIMEZONE);
    const nowTs = Timestamp.now();
    const peak =
      formPeakAudience.trim() === '' ? null : Math.max(0, parseInt(formPeakAudience.trim(), 10) || 0);

    const sessionPayload: SessionDoc<Timestamp> = {
      startsAt: Timestamp.fromMillis(startsAtMs),
      endsAt: Timestamp.fromMillis(endsAtMs),
      timezone: APP_CONFIG.TIMEZONE,
      title: null,
      topic: formTopic.trim() || null,
      opensOffsetMin: Number(formOpensOffset),
      closesOffsetMin: Number(formClosesOffset),
      status: formStatus,
      requireKeyword: formRequireKeyword,
      peakAudience: peak,
      notes: formNotes.trim() || null,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    await setDoc(doc(db, 'sessions', formSessionId), sessionPayload);
    if (formKeyword.trim()) {
      await setDoc(doc(db, 'sessionSecrets', formSessionId), {
        keyword: formKeyword.trim(),
        fuzzy: formFuzzy,
        updatedAt: nowTs,
      });
    }
    setStatusMessage(`Saved session ${formSessionId}`);
    await loadAllAdminData();
  };

  const candidates = useMemo(
    () => generateTueThuCandidates(genStartDate, genWeeks),
    [genStartDate, genWeeks],
  );

  const handleGenerateBatch = async () => {
    const existingIds = new Set(sessions.map((s) => s.id));
    const toCreate = candidates.filter((c) => !genDeselected.has(c.id) && !existingIds.has(c.id));
    const nowTs = Timestamp.now();
    for (const c of toCreate) {
      const payload: SessionDoc<Timestamp> = {
        startsAt: Timestamp.fromMillis(c.startsAtMs),
        endsAt: Timestamp.fromMillis(c.endsAtMs),
        timezone: APP_CONFIG.TIMEZONE,
        title: null,
        topic: null,
        opensOffsetMin: APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN,
        closesOffsetMin: APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN,
        status: 'scheduled',
        requireKeyword: true,
        peakAudience: null,
        notes: null,
        createdAt: nowTs,
        updatedAt: nowTs,
      };
      await setDoc(doc(db, 'sessions', c.id), payload);
    }
    setStatusMessage(`Generated ${toCreate.length} session(s)`);
    await loadAllAdminData();
  };

  const handleDeleteCheckin = async (checkinId: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/delete-checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ checkinId }),
    });
    if (res.ok) {
      setStatusMessage(`Deleted check-in ${checkinId}`);
      await loadAllAdminData();
    } else {
      setStatusMessage('Failed to delete check-in');
    }
  };

  const handleRecomputeStats = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/recompute-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      setStatusMessage('Recomputed all stats from raw check-ins');
      await loadAllAdminData();
    } else {
      setStatusMessage('Failed to recompute stats');
    }
  };

  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSessionsCsv = () => {
    const rows = sessions.map((s) => ({
      sessionId: s.id,
      startsAt: s.doc.startsAt.toDate().toISOString(),
      endsAt: s.doc.endsAt.toDate().toISOString(),
      topic: s.doc.topic ?? '',
      status: s.doc.status,
      opensOffsetMin: s.doc.opensOffsetMin,
      closesOffsetMin: s.doc.closesOffsetMin,
      checkins: s.stats.total,
      peakAudience: s.doc.peakAudience ?? '',
      averageRating:
        s.stats.ratingCount > 0 ? (s.stats.ratingSum / s.stats.ratingCount).toFixed(2) : '',
    }));
    downloadCsv(
      `englishtalk-sessions.csv`,
      toCsv(rows, [
        'sessionId',
        'startsAt',
        'endsAt',
        'topic',
        'status',
        'opensOffsetMin',
        'closesOffsetMin',
        'checkins',
        'peakAudience',
        'averageRating',
      ]),
    );
  };

  const handleExportCheckinsCsv = () => {
    const rows = checkins.map((c) => ({
      checkinId: c.id,
      sessionId: c.doc.sessionId,
      email: c.doc.email,
      emailCanonical: c.doc.emailCanonical,
      emailDomain: c.doc.emailDomain,
      country: c.doc.country,
      role: c.doc.role ?? '',
      speaking: c.doc.speaking,
      level: c.doc.level ?? '',
      rating: c.doc.rating,
      comment: c.doc.comment ?? '',
      topicSuggestion: c.doc.topicSuggestion ?? '',
      keywordMatch: c.doc.keywordMatch,
      uiLanguage: c.doc.uiLanguage,
      isTeacher: c.doc.isTeacher,
      late: c.doc.late,
      submittedAt: c.doc.submittedAt.toDate().toISOString(),
    }));
    downloadCsv(
      `englishtalk-checkins.csv`,
      toCsv(rows, [
        'checkinId',
        'sessionId',
        'email',
        'emailCanonical',
        'emailDomain',
        'country',
        'role',
        'speaking',
        'level',
        'rating',
        'comment',
        'topicSuggestion',
        'keywordMatch',
        'uiLanguage',
        'isTeacher',
        'late',
        'submittedAt',
      ]),
    );
  };

  const aggregate = useMemo(() => {
    let totalCheckins = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    const byCountry: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    const byMonth = new Map<string, number>();

    for (const s of sessions) {
      totalCheckins += s.stats.total;
      ratingSum += s.stats.ratingSum;
      ratingCount += s.stats.ratingCount;
      for (const [k, v] of Object.entries(s.stats.byCountry)) {
        const key = decodeStatsKey(k);
        byCountry[key] = (byCountry[key] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(s.stats.byDomain)) {
        const key = decodeStatsKey(k);
        byDomain[key] = (byDomain[key] ?? 0) + v;
      }
      const monthKey = s.id.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + s.stats.total);
    }

    const trend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, checkins: count }));

    return {
      totalSessions: sessions.filter((s) => s.doc.status === 'scheduled').length,
      totalCheckins,
      avgRating: ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : '—',
      countries: Object.entries(byCountry).sort((a, b) => b[1] - a[1]),
      domains: Object.entries(byDomain).sort((a, b) => b[1] - a[1]),
      trend,
    };
  }, [sessions]);

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
        Checking admin session...
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-md space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <h1 className="text-xl font-bold text-[var(--text)]">Teacher Admin · {APP_CONFIG.APP_NAME}</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Restricted to authorized teachers ({ALLOWED_ADMIN_EMAILS.join(', ')}).
        </p>

        {unauthorizedEmail && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/60 bg-red-500/10 p-3 text-sm font-medium text-red-300"
          >
            No access for <strong>{unauthorizedEmail}</strong>. You have been signed out.
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/60 bg-red-500/10 p-3 text-xs text-red-300"
          >
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            const provider = new GoogleAuthProvider();
            void signInWithPopup(auth, provider).catch((e: unknown) =>
              setAuthError(e instanceof Error ? e.message : 'Sign-in failed'),
            );
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-md hover:opacity-95"
        >
          🔐 Sign in with Google
        </button>

        <div className="border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Fallback: Sign in with email link
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailLinkAddress.trim()) return;
              window.localStorage.setItem('englishtalk:adminEmailForSignIn', emailLinkAddress.trim());
              void sendSignInLinkToEmail(auth, emailLinkAddress.trim(), {
                url: `${window.location.origin}/admin`,
                handleCodeInApp: true,
              })
                .then(() => setEmailLinkSent(true))
                .catch((err: unknown) =>
                  setAuthError(err instanceof Error ? err.message : 'Could not send link'),
                );
            }}
            className="flex gap-2"
          >
            <label htmlFor="admin-email-link" className="sr-only">
              Admin Email
            </label>
            <input
              id="admin-email-link"
              type="email"
              placeholder="daniel.buck@rocketseat.team"
              value={emailLinkAddress}
              onChange={(e) => setEmailLinkAddress(e.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
            />
            <button
              type="submit"
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)]"
            >
              Send link
            </button>
          </form>
          {emailLinkSent && (
            <p className="mt-2 text-xs text-[var(--accent)]">Check your inbox for the sign-in link.</p>
          )}
        </div>
      </section>
    );
  }

  const openSession =
    sessions.find((s) =>
      isOpenAt(
        {
          startsAtMs: s.doc.startsAt.toMillis(),
          opensOffsetMin: s.doc.opensOffsetMin,
          closesOffsetMin: s.doc.closesOffsetMin,
          status: s.doc.status,
        },
        nowMs,
      ),
    ) ?? sessions[0];

  const activeSession = sessions.find((s) => s.id === selectedSessionId) ?? openSession ?? null;
  const metricsSession =
    sessions.find((s) => s.id === metricsSessionId) ??
    sessions.find((s) => s.stats.total > 0) ??
    activeSession;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Teacher Dan · Admin Panel</h1>
          <p className="text-xs text-[var(--text-secondary)]">Signed in as {user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['sessions', 'live', 'metrics', 'share'] as const).map((tKey) => (
            <button
              key={tKey}
              type="button"
              onClick={() => setTab(tKey)}
              className={`min-h-11 rounded-xl px-3.5 text-xs font-bold capitalize transition ${
                tab === tKey
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]'
              }`}
            >
              {tKey}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-4 py-2.5 text-xs font-medium text-[var(--text)]"
        >
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="px-2 font-bold">
            ×
          </button>
        </div>
      )}

      {tab === 'share' && (
        <Suspense fallback={<div className="p-6 text-center text-sm">Loading QR...</div>}>
          <ShareScreen />
        </Suspense>
      )}

      {tab === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label htmlFor="live-session-select" className="text-xs font-semibold text-[var(--text-secondary)]">
              Session:
            </label>
            <select
              id="live-session-select"
              value={activeSession?.id ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} {s.doc.topic ? `· ${s.doc.topic}` : ''}
                </option>
              ))}
            </select>
          </div>
          <LiveView db={db} sessionId={activeSession?.id ?? null} sessionTopic={activeSession?.doc.topic} />
        </div>
      )}

      {tab === 'sessions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Create / Edit form */}
          <form
            onSubmit={(e) => void handleSaveSession(e)}
            className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 lg:col-span-7"
          >
            <h2 className="text-base font-bold text-[var(--text)]">Create / Edit Session</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="s-id" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Session ID
                </label>
                <input
                  id="s-id"
                  type="text"
                  value={formSessionId}
                  onChange={(e) => setFormSessionId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor="s-date" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Date (Brasília)
                </label>
                <input
                  id="s-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value);
                    setFormSessionId(e.target.value);
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="s-start" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Start (BRT)
                </label>
                <input
                  id="s-start"
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor="s-end" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  End (BRT)
                </label>
                <input
                  id="s-end"
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="s-topic" className="block text-xs font-semibold text-[var(--text-secondary)]">
                Conversation Topic (shown to students)
              </label>
              <input
                id="s-topic"
                type="text"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g. Career transitions & remote work"
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="s-open-off" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Opens before start (min)
                </label>
                <input
                  id="s-open-off"
                  type="number"
                  min={0}
                  max={2880}
                  value={formOpensOffset}
                  onChange={(e) => setFormOpensOffset(Number(e.target.value))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor="s-close-off" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Closes after start (min)
                </label>
                <input
                  id="s-close-off"
                  type="number"
                  min={0}
                  max={2880}
                  value={formClosesOffset}
                  onChange={(e) => setFormClosesOffset(Number(e.target.value))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="s-keyword" className="text-xs font-semibold text-[var(--text-secondary)]">
                  Secret Keyword (admin-only)
                </label>
                <button
                  type="button"
                  onClick={() => setFormKeyword(suggestRandomKeyword(new Set(usedKeywordsMap.keys())))}
                  className="text-xs font-bold text-[var(--primary)] hover:underline"
                >
                  🎲 Suggest word
                </button>
              </div>
              <input
                id="s-keyword"
                type="text"
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="e.g. breakthrough"
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
              />
              {duplicateKeywordSession && (
                <p role="alert" className="mt-1 text-xs font-semibold text-amber-400">
                  ⚠️ This keyword was already used in session {duplicateKeywordSession}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="s-peak" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Peak Zoom Audience (excl. teacher)
                </label>
                <input
                  id="s-peak"
                  type="number"
                  min={0}
                  value={formPeakAudience}
                  onChange={(e) => setFormPeakAudience(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor="s-status" className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Status
                </label>
                <select
                  id="s-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'scheduled' | 'cancelled')}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--text)]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formRequireKeyword}
                  onChange={(e) => setFormRequireKeyword(e.target.checked)}
                />
                Require secret keyword
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formFuzzy}
                  onChange={(e) => setFormFuzzy(e.target.checked)}
                />
                Allow 1-typo fuzzy match
              </label>
            </div>

            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white"
            >
              Save Session
            </button>
          </form>

          {/* Generator + Session list */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
              <h2 className="text-base font-bold text-[var(--text)]">
                Generate Tue/Thu Sessions (18:00–19:00 BRT)
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="gen-start"
                    className="block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Starting from
                  </label>
                  <input
                    id="gen-start"
                    type="date"
                    value={genStartDate}
                    onChange={(e) => setGenStartDate(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-weeks"
                    className="block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Weeks
                  </label>
                  <input
                    id="gen-weeks"
                    type="number"
                    min={1}
                    max={16}
                    value={genWeeks}
                    onChange={(e) => setGenWeeks(Number(e.target.value))}
                    className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="mt-3 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {candidates.map((c) => {
                  const skipped = genDeselected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setGenDeselected((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        skipped
                          ? 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] line-through'
                          : 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)]'
                      }`}
                    >
                      {c.weekday === 2 ? 'Tue' : 'Thu'} {c.dateKey}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleGenerateBatch()}
                className="mt-4 min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#121214]"
              >
                Generate Selected Sessions
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--text)]">
                  Sessions ({sessions.length})
                </h2>
                {loadingData && <span className="text-xs text-[var(--text-secondary)]">Refreshing...</span>}
              </div>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => populateFormFromSession(s)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-left text-xs hover:border-[var(--primary)]"
                    >
                      <div>
                        <span className="font-bold text-[var(--text)]">{s.id}</span>
                        {s.doc.topic && (
                          <span className="ml-2 text-[var(--text-secondary)]">· {s.doc.topic}</span>
                        )}
                        {s.doc.status === 'cancelled' && (
                          <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        {s.secret?.keyword && <span>🔑 {s.secret.keyword}</span>}
                        <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono font-bold text-[var(--text)]">
                          {s.stats.total}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'metrics' && (
        <div className="space-y-6">
          {/* Overall summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">Sessions</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">{aggregate.totalSessions}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">Total Check-ins</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">{aggregate.totalCheckins}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">Unique Students</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">{studentsCount.total}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">Returning</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--accent)]">{studentsCount.returning}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">Avg Rating</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">⭐ {aggregate.avgRating}</p>
            </div>
          </div>

          {/* Export and Data hygiene actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportSessionsCsv}
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
            >
              ⬇️ Export Sessions CSV
            </button>
            <button
              type="button"
              onClick={handleExportCheckinsCsv}
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
            >
              ⬇️ Export Check-ins CSV
            </button>
            <button
              type="button"
              onClick={() => void handleRecomputeStats()}
              className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text)]"
            >
              🔧 Recompute Stats
            </button>
          </div>

          {/* Per-session breakdown (§9) */}
          {metricsSession && (
            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)]">Per-Session Breakdown</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Select any class to inspect attendance, Zoom conversion, rating, speaking, and level
                  </p>
                </div>
                <select
                  aria-label="Select session for metrics"
                  value={metricsSession.id}
                  onChange={(e) => setMetricsSessionId(e.target.value)}
                  className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text)]"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                      {s.doc.topic ? ` · ${s.doc.topic}` : ''} ({s.stats.total} check-ins)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <p className="text-xs text-[var(--text-secondary)]">Check-ins</p>
                  <p className="mt-1 text-xl font-extrabold text-[var(--text)]">
                    {metricsSession.stats.total}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <p className="text-xs text-[var(--text-secondary)]">Peak Audience</p>
                  <p className="mt-1 text-xl font-extrabold text-[var(--text)]">
                    {metricsSession.doc.peakAudience ?? '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <p className="text-xs text-[var(--text-secondary)]">Check-ins ÷ Peak</p>
                  <p className="mt-1 text-xl font-extrabold text-[var(--accent)]">
                    {metricsSession.doc.peakAudience && metricsSession.doc.peakAudience > 0
                      ? `${((metricsSession.stats.total / metricsSession.doc.peakAudience) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <p className="text-xs text-[var(--text-secondary)]">Avg Rating</p>
                  <p className="mt-1 text-xl font-extrabold text-[var(--primary)]">
                    ⭐{' '}
                    {metricsSession.stats.ratingCount > 0
                      ? (metricsSession.stats.ratingSum / metricsSession.stats.ratingCount).toFixed(2)
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <h3 className="mb-2 text-xs font-bold text-[var(--text)]">Speaking</h3>
                  <ul className="space-y-1 text-xs">
                    {Object.entries(metricsSession.stats.bySpeaking)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, count]) => {
                        const key = decodeStatsKey(k);
                        return (
                          <li key={key} className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)]">
                              {SPEAKING_LABELS[key] ?? key}
                            </span>
                            <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <h3 className="mb-2 text-xs font-bold text-[var(--text)]">Level</h3>
                  <ul className="space-y-1 text-xs">
                    {Object.entries(metricsSession.stats.byLevel)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, count]) => {
                        const key = decodeStatsKey(k);
                        return (
                          <li key={key} className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)]">
                              {LEVEL_LABELS[key] ?? key}
                            </span>
                            <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <h3 className="mb-2 text-xs font-bold text-[var(--text)]">Countries</h3>
                  <ul className="space-y-1 text-xs">
                    {Object.entries(metricsSession.stats.byCountry)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, count]) => {
                        const code = decodeStatsKey(k);
                        return (
                          <li key={code} className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)]">
                              {flagEmoji(code)} {code}
                            </span>
                            <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
                  <h3 className="mb-2 text-xs font-bold text-[var(--text)]">Roles</h3>
                  <ul className="space-y-1 text-xs">
                    {Object.entries(metricsSession.stats.byRole)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, count]) => {
                        const key = decodeStatsKey(k);
                        return (
                          <li key={key} className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)]">
                              {ROLE_LABELS[key] ?? key}
                            </span>
                            <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Trend chart */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--text)]">Attendance Trend by Month</h2>
            <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-[var(--bg)]" />}>
              <TrendChart data={aggregate.trend} />
            </Suspense>
          </div>

          {/* Countries & Domains */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-3 text-sm font-bold text-[var(--text)]">Top Countries</h2>
              <ul className="space-y-1.5 text-xs">
                {aggregate.countries.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between">
                    <span>
                      {flagEmoji(code)} {code}
                    </span>
                    <span className="font-mono font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-3 text-sm font-bold text-[var(--text)]">Email Domains</h2>
              <ul className="space-y-1.5 text-xs">
                {aggregate.domains.map(([dom, count]) => (
                  <li key={dom} className="flex items-center justify-between">
                    <span>{dom}</span>
                    <span className="font-mono font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Topic suggestions & comments feed + delete check-in */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--text)]">
              Recent Check-ins, Topic Suggestions & Comments
            </h2>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
              {checkins.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--text)]">
                      {flagEmoji(c.doc.country)} {c.doc.email} ·{' '}
                      <span className="text-[var(--text-secondary)]">{c.doc.sessionId}</span> · ⭐{' '}
                      {c.doc.rating}
                      {c.doc.isTeacher && (
                        <span className="ml-2 rounded bg-[var(--primary)]/20 px-1.5 py-0.5 text-[10px] text-[var(--primary)]">
                          TEACHER
                        </span>
                      )}
                    </p>
                    {c.doc.topicSuggestion && (
                      <p className="text-[var(--accent)]">💡 Topic: {c.doc.topicSuggestion}</p>
                    )}
                    {c.doc.comment && <p className="text-[var(--text-secondary)]">💬 {c.doc.comment}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCheckin(c.id)}
                    className="rounded-lg border border-red-400/40 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
