import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../../config/app';
import { formatTime, splitDuration } from '../../../shared/time';
import type { PublicSession } from '../../../shared/schemas';
import { NextClassCard } from './NextClassCard';

function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, '0')}h`);
  parts.push(`${String(minutes).padStart(2, '0')}m`);
  parts.push(`${String(seconds).padStart(2, '0')}s`);
  return parts.join(' ');
}

interface ClosedStateProps {
  nextSession: PublicSession | null;
  clockOffsetMs: number;
}

export function ClosedState({ nextSession, clockOffsetMs }: ClosedStateProps) {
  const { t, i18n } = useTranslation();
  const [serverNowMs, setServerNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    const id = setInterval(() => {
      setServerNowMs(Date.now() + clockOffsetMs);
    }, 1000);
    return () => clearInterval(id);
  }, [clockOffsetMs]);

  if (!nextSession) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg sm:p-10">
        <div aria-hidden="true" className="mx-auto mb-3 text-3xl">
          🗓️
        </div>
        <h1 className="text-xl font-bold text-[var(--text)] sm:text-2xl">{t('states.noSessionsTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('states.noSessionsBody')}</p>
      </section>
    );
  }

  const opensAtMs = Date.parse(nextSession.opensAt);
  const remainingMs = Math.max(0, opensAtMs - serverNowMs);
  const opensTimeBrt = formatTime(opensAtMs, i18n.language, APP_CONFIG.TIMEZONE);

  return (
    <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg sm:p-8 md:max-w-3xl">
      <div aria-hidden="true" className="mx-auto text-3xl">
        ⏰
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-[var(--text)] sm:text-2xl">{t('states.closedTitle')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('states.closedSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <div className="flex flex-col justify-center rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-5 py-4">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {t('states.opensAtLabel', { time: opensTimeBrt, tz: APP_CONFIG.TIMEZONE_LABEL })}
          </p>
          <p aria-live="off" className="mt-1.5 font-mono text-xl font-bold text-[var(--text)] sm:text-2xl">
            {t('states.opensIn', { countdown: formatCountdown(remainingMs) })}
          </p>
        </div>

        <NextClassCard session={nextSession} />
      </div>
    </section>
  );
}
