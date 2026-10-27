import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../../config/app';
import { deviceTimeZone, formatLongMoment } from '../../../shared/time';
import type { PublicSession } from '../../../shared/schemas';

export function NextClassCard({ session }: { session: PublicSession }) {
  const { t, i18n } = useTranslation();
  const startsAtMs = Date.parse(session.startsAt);
  const localTz = deviceTimeZone() ?? APP_CONFIG.TIMEZONE;
  const sameZone = localTz === APP_CONFIG.TIMEZONE;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
        📅 {t('states.nextClassCardTitle')}
      </p>
      {session.topic && <p className="mt-1 text-base font-semibold text-[var(--text)]">{session.topic}</p>}
      <dl className="mt-2 space-y-1.5 text-sm">
        <div>
          <dt className="text-xs text-[var(--text-secondary)]">{t('states.brasiliaTime')}</dt>
          <dd className="font-semibold text-[var(--text)]">
            {formatLongMoment(startsAtMs, i18n.language, APP_CONFIG.TIMEZONE)}
          </dd>
        </div>
        {!sameZone && (
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">
              {t('states.yourLocalTime', { tz: localTz })}
            </dt>
            <dd className="font-semibold text-[var(--text)]">
              {formatLongMoment(startsAtMs, i18n.language, localTz)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
