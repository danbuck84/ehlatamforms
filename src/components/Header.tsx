import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../config/app';
import { UI_LANGUAGES, type UiLanguage } from '../../shared/constants';
import { setAppLanguage } from '../i18n';
import { useTheme } from '../lib/theme';

export function Header() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const currentLang = (i18n.language?.slice(0, 2) || 'en') as UiLanguage;

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <img src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-[var(--text)]">
              {APP_CONFIG.APP_NAME}
            </span>
            <span className="block text-[11px] text-[var(--text-secondary)]">{APP_CONFIG.CO_BRAND}</span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label={t('app.languageLabel')}
            className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] p-0.5"
          >
            {UI_LANGUAGES.map((lang) => {
              const active = currentLang === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => void setAppLanguage(lang)}
                  aria-pressed={active}
                  className={`min-h-11 min-w-11 rounded-lg px-2.5 text-xs font-semibold uppercase ${
                    active
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`${t('app.themeToggle')} (${theme === 'dark' ? t('app.themeLight') : t('app.themeDark')})`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] hover:border-[var(--primary)]"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
