import { useEffect, useState } from 'react';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import { flagEmoji } from '../../../shared/country';
import { decodeStatsKey, emptyStats, type SessionStatsDoc } from '../../../shared/models';

interface LiveViewProps {
  db: Firestore;
  sessionId: string | null;
  sessionTopic?: string | null;
}

export function LiveView({ db, sessionId, sessionTopic }: LiveViewProps) {
  const [stats, setStats] = useState<SessionStatsDoc>(emptyStats);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, 'sessionStats', sessionId), (snap) => {
      if (snap.exists()) {
        setStats({ ...emptyStats(), ...(snap.data() as Partial<SessionStatsDoc>) });
      } else {
        setStats(emptyStats());
      }
    });
    return () => unsub();
  }, [db, sessionId]);

  if (!sessionId) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[#121214] p-10 text-center text-white">
        <p className="text-lg">Select or open a session to launch Live Projector Mode.</p>
      </div>
    );
  }

  const countries = Object.entries(stats.byCountry)
    .map(([k, count]) => ({ code: decodeStatsKey(k), count }))
    .sort((a, b) => b.count - a.count);

  const avgRating = stats.ratingCount > 0 ? (stats.ratingSum / stats.ratingCount).toFixed(1) : '—';

  return (
    <section
      aria-label="Live projector view"
      className="rounded-3xl border-2 border-[#8257E5] bg-[#121214] p-8 text-white shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#323238] pb-5">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#04D361]/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#04D361]">
            ● Live Check-in · {sessionId}
          </span>
          {sessionTopic && <h2 className="mt-2 text-2xl font-bold">{sessionTopic}</h2>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-[#A8A8B3]">Average Rating</p>
          <p className="text-3xl font-extrabold text-[#04D361]">⭐ {avgRating}</p>
        </div>
      </div>

      <div className="my-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#A8A8B3]">Students Checked In</p>
        <p aria-live="polite" className="mt-2 font-mono text-7xl font-black tracking-tight text-white sm:text-8xl">
          {stats.total}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-[#A8A8B3]">
          Countries in today&apos;s room ({countries.length})
        </h3>
        {countries.length === 0 ? (
          <p className="text-center text-sm text-[#A8A8B3]">Waiting for the first check-in...</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {countries.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-2 rounded-2xl border border-[#323238] bg-[#202024] px-4 py-2.5 text-lg font-bold"
              >
                <span className="text-2xl">{flagEmoji(c.code)}</span>
                <span>{c.code}</span>
                <span className="rounded-lg bg-[#8257E5] px-2 py-0.5 text-sm text-white">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
