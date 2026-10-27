import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../../config/app';
import type { PublicSession } from '../../../shared/schemas';
import { useInstallPrompt } from '../../lib/pwa';
import { NextClassCard } from './NextClassCard';

interface SuccessScreenProps {
  variant: 'created' | 'duplicate' | 'queued';
  nextSession: PublicSession | null;
}

export function SuccessScreen({ variant, nextSession }: SuccessScreenProps) {
  const { t } = useTranslation();
  const { canPromptChromium, showIosGuide, triggerInstall } = useInstallPrompt();
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  const title =
    variant === 'duplicate'
      ? t('states.duplicateTitle')
      : variant === 'queued'
        ? t('states.queuedTitle')
        : t('states.successTitle');

  const body =
    variant === 'duplicate'
      ? t('states.duplicateBody')
      : variant === 'queued'
        ? t('states.queuedBody')
        : null;

  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-xl"
    >
      <div aria-hidden="true" className="celebration-burst mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/15 text-3xl">
        {variant === 'queued' ? '📡' : '🎉'}
      </div>

      <h1 className="text-xl font-bold text-[var(--text)]">{title}</h1>
      {body && <p className="mt-2 text-sm text-[var(--text-secondary)]">{body}</p>}

      {nextSession && (
        <div className="mt-5">
          <NextClassCard session={nextSession} />
        </div>
      )}

      {(canPromptChromium || showIosGuide) && (
        <div className="mt-5 rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--text)]">
            {t('states.installTitle', { appName: APP_CONFIG.APP_NAME })}
          </p>
          {canPromptChromium ? (
            <button
              type="button"
              onClick={() => void triggerInstall()}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              📲 {t('states.installButton')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIosSheetOpen((v) => !v)}
              aria-expanded={iosSheetOpen}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              📲 {t('states.iosInstallButton')}
            </button>
          )}

          {iosSheetOpen && (
            <div
              role="region"
              aria-label={t('states.iosSheetTitle', { appName: APP_CONFIG.APP_NAME })}
              className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs text-[var(--text)]"
            >
              <p className="font-semibold">
                {t('states.iosSheetTitle', { appName: APP_CONFIG.APP_NAME })}
              </p>
              <ol className="mt-1.5 space-y-1 text-[var(--text-secondary)]">
                <li>{t('states.iosStep1')}</li>
                <li>{t('states.iosStep2')}</li>
                <li>{t('states.iosStep3')}</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
