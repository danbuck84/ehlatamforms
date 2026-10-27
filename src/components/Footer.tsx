import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-auto border-t border-[var(--border)] py-5 text-center text-xs text-[var(--text-secondary)]">
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
        <span>{t('app.privacyNote')}</span>
        <Link
          to="/privacy"
          className=" inline-flex min-h-11 items-center px-2 font-medium text-[var(--text)] underline underline-offset-4 hover:text-[var(--primary)]"
        >
          {t('app.privacyLink')}
        </Link>
      </div>
    </footer>
  );
}
