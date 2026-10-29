import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../config/app';

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text)] shadow-lg sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t('privacy.title')}</h1>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)]"
        >
          ← {t('app.backToCheckin')}
        </Link>
      </div>

      <p className="text-[var(--text-secondary)]">{t('privacy.intro', { appName: APP_CONFIG.APP_NAME })}</p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('privacy.whatWeCollectTitle')}</h2>
          <p className="text-[var(--text-secondary)]">{t('privacy.whatWeCollectBody')}</p>
        </section>

        <section className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('privacy.howWeUseItTitle')}</h2>
          <p className="text-[var(--text-secondary)]">{t('privacy.howWeUseItBody')}</p>
        </section>

        <section className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('privacy.localStorageTitle')}</h2>
          <p className="text-[var(--text-secondary)]">{t('privacy.localStorageBody')}</p>
        </section>

        <section className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('privacy.contactTitle')}</h2>
          <p className="text-[var(--text-secondary)]">{t('privacy.contactBody')}</p>
        </section>
      </div>
    </article>
  );
}
