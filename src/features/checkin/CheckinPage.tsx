import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../../config/app';
import { formatClassMoment } from '../../../shared/time';
import { fetchCurrentSessions } from '../../lib/api';
import { CheckinForm } from './CheckinForm';
import { ClosedState } from './ClosedState';

export function CheckinPage() {
  const { t, i18n } = useTranslation();
  const [chosenSessionId, setChosenSessionId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['sessions', 'current'],
    queryFn: fetchCurrentSessions,
    refetchInterval: 60_000,
    retry: 1,
  });

  if (query.isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8"
      >
        <p className="text-sm font-medium text-[var(--text-secondary)]">{t('states.loading')}</p>
        <div className="h-6 w-2/3 animate-pulse rounded-lg bg-[var(--border)]" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-[var(--border)]" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-[var(--border)]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <section
        role="alert"
        className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg sm:p-10"
      >
        <div aria-hidden="true" className="text-3xl">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-[var(--text)]">{t('states.serverErrorTitle')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('states.serverErrorBody')}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t('states.retry')}
        </button>
      </section>
    );
  }

  const { data, clockOffsetMs } = query.data;
  const openSessions = data.open;

  if (openSessions.length === 0) {
    return <ClosedState nextSession={data.next} clockOffsetMs={clockOffsetMs} />;
  }

  // If an admin created overlapping sessions, show a chooser so the student can pick theirs
  const activeSession =
    openSessions.find((s) => s.id === chosenSessionId) ?? openSessions[0]!;

  return (
    <div className="mx-auto max-w-xl space-y-4 lg:max-w-5xl">
      {openSessions.length > 1 && (
        <div
          role="region"
          aria-label={t('header.chooseSessionLabel')}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            {t('header.chooseSessionLabel')}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {openSessions.map((s) => {
              const selected = s.id === activeSession.id;
              const moment = formatClassMoment(Date.parse(s.startsAt), i18n.language, APP_CONFIG.TIMEZONE);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChosenSessionId(s.id)}
                  className={`flex min-h-11 items-center justify-between rounded-xl border px-3.5 py-2 text-left text-xs font-semibold transition ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]'
                  }`}
                >
                  <span>
                    {moment}
                    {s.topic ? ` · ${s.topic}` : ''}
                  </span>
                  <span aria-hidden="true">{selected ? '●' : '○'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <CheckinForm
        key={activeSession.id}
        session={activeSession}
        nextSession={data.next}
        clockOffsetMs={clockOffsetMs}
      />
    </div>
  );
}
