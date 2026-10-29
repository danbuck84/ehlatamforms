import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '../../config/app';
import {
  LEVELS,
  LIMITS,
  SPEAKING,
  isCountryCode,
  type Role,
  type UiLanguage,
} from '../../../shared/constants';
import {
  isBlockedDomain,
  isValidEmailShape,
  normalizeEmail,
  splitEmail,
  suggestEmail,
} from '../../../shared/email';
import { formatClassMoment } from '../../../shared/time';
import type { CheckinRequest, PublicSession } from '../../../shared/schemas';
import { ApiError, submitCheckin } from '../../lib/api';
import { enqueue } from './offline-queue';
import { CountryCombobox } from './CountryCombobox';
import { NextClassCard } from './NextClassCard';
import { RatingRadioGroup } from './RatingRadioGroup';
import { SuccessScreen } from './SuccessScreen';
import {
  clearDraft,
  clearReturningProfile,
  loadInitialDraft,
  saveDraft,
  saveReturningProfile,
  type CheckinDraft,
} from './storage';

const ROLE_CHOICES: readonly Exclude<Role, 'other'>[] = [
  'rocketseat_student',
  'digital_house_student',
  'dhrs_team',
];

interface CheckinFormProps {
  session: PublicSession;
  nextSession: PublicSession | null;
  clockOffsetMs: number;
}

export function CheckinForm({ session, nextSession, clockOffsetMs }: CheckinFormProps) {
  const { t, i18n } = useTranslation();
  const baseId = useId();

  const initial = useMemo(() => loadInitialDraft(session.id), [session.id]);
  const [draft, setDraft] = useState<CheckinDraft>(initial.draft);
  const [prefilledEmail, setPrefilledEmail] = useState<string | null>(initial.prefilledEmail);
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rateLimitSec, setRateLimitSec] = useState<number | null>(null);
  const [serverError, setServerError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    variant: 'created' | 'duplicate' | 'queued';
    next: PublicSession | null;
  } | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Bot heuristic: track when the student opened the form
  const startedAtRef = useRef<number>(nowMs);
  // Stable submission UUID across retries for the same session form instance
  const [submissionId] = useState<string>(() => crypto.randomUUID());
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    saveDraft(session.id, draft);
  }, [session.id, draft]);

  useEffect(() => {
    if (rateLimitSec === null || rateLimitSec <= 0) return;
    const id = setInterval(() => {
      setRateLimitSec((s) => (s !== null && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimitSec]);

  const updateDraft = (patch: Partial<CheckinDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setFieldErrors({});
    setServerError(false);
    updateDraft({ step: nextStep });
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  };

  const emailSuggestion = useMemo(() => suggestEmail(draft.email), [draft.email]);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    const email = normalizeEmail(draft.email);
    const { domain } = splitEmail(email);

    if (!isValidEmailShape(email)) {
      errs.email = t('fields.emailError');
    } else if (isBlockedDomain(domain)) {
      const suggestion = suggestEmail(email) ?? `...@gmail.com`;
      errs.email = t('fields.emailBlockedError', { suggestion });
    }
    if (!draft.country || !isCountryCode(draft.country)) {
      errs.country = t('fields.countryError');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!draft.speaking) {
      errs.speaking = t('fields.speakingError');
    }
    if (!draft.rating) {
      errs.rating = t('fields.ratingError');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (session.requireKeyword && !draft.keyword.trim()) {
      errs.keyword = t('fields.keywordRequiredError');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (draft.step === 1 && validateStep1()) {
      goToStep(2);
    } else if (draft.step === 2 && validateStep2()) {
      goToStep(3);
    }
  };

  const handleResetReturning = () => {
    clearReturningProfile();
    setPrefilledEmail(null);
    updateDraft({ email: '', role: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.step === 1) {
      if (validateStep1()) goToStep(2);
      return;
    }
    if (draft.step === 2) {
      if (validateStep2()) goToStep(3);
      return;
    }
    if (!validateStep1()) {
      goToStep(1);
      return;
    }
    if (!validateStep2()) {
      goToStep(2);
      return;
    }
    if (!validateStep3()) return;
    if (!draft.country || !draft.speaking || !draft.rating) return;

    setSubmitting(true);
    setServerError(false);
    setFieldErrors({});

    const serverNowMs = Date.now() + clockOffsetMs;
    const elapsedMs = Math.max(LIMITS.minTimeToSubmitMs, Date.now() - startedAtRef.current);
    const uiLang = (i18n.language?.slice(0, 2) || 'en') as UiLanguage;

    const payload: CheckinRequest = {
      sessionId: session.id,
      email: normalizeEmail(draft.email),
      country: draft.country,
      role: draft.role,
      speaking: draft.speaking,
      level: draft.level,
      rating: draft.rating,
      keyword: draft.keyword.trim(),
      comment: draft.comment.trim() ? draft.comment.trim() : null,
      topicSuggestion: draft.topicSuggestion.trim() ? draft.topicSuggestion.trim() : null,
      uiLanguage: uiLang === 'pt' || uiLang === 'es' ? uiLang : 'en',
      clientSubmissionId: submissionId,
      clientCapturedAt: new Date(serverNowMs).toISOString(),
      elapsedMs,
      website: websiteHoneypot,
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0',
    };

    try {
      const res = await submitCheckin(payload);
      saveReturningProfile({
        email: payload.email,
        country: payload.country,
        role: payload.role,
      });
      clearDraft(session.id);
      setDone({ variant: res.status, next: res.next ?? nextSession });
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.data.error;
        if (code === 'rate_limited') {
          setRateLimitSec(err.data.retryAfter ?? 60);
        } else if (code === 'keyword_wrong') {
          setFieldErrors({ keyword: t('fields.keywordWrongError') });
        } else if (code === 'keyword_required') {
          setFieldErrors({ keyword: t('fields.keywordRequiredError') });
        } else if (code === 'email_blocked') {
          setFieldErrors({
            email: t('fields.emailBlockedError', {
              suggestion: err.data.suggestion ?? '...@gmail.com',
            }),
          });
          goToStep(1);
        } else if (code === 'email_domain_invalid') {
          setFieldErrors({ email: t('fields.emailDomainInvalidError') });
          goToStep(1);
        } else {
          setServerError(true);
        }
      } else {
        // Network failure / offline -> save to IndexedDB offline queue
        await enqueue(payload);
        saveReturningProfile({
          email: payload.email,
          country: payload.country,
          role: payload.role,
        });
        clearDraft(session.id);
        window.dispatchEvent(new CustomEvent('englishtalk:queue-updated'));
        if ('serviceWorker' in navigator) {
          void navigator.serviceWorker.ready
            .then((reg) => {
              const syncReg = reg as ServiceWorkerRegistration & {
                sync?: { register: (tag: string) => Promise<void> };
              };
              return syncReg.sync?.register('checkin-queue');
            })
            .catch(() => undefined);
        }
        setDone({ variant: 'queued', next: nextSession });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startsAtMs = Date.parse(session.startsAt);
  const serverNowMs = nowMs + clockOffsetMs;
  const beforeClassStart = serverNowMs < startsAtMs;
  const chipMoment = formatClassMoment(startsAtMs, i18n.language, APP_CONFIG.TIMEZONE);

  if (done) {
    return <SuccessScreen variant={done.variant} nextSession={done.next} />;
  }

  const stepTitle =
    draft.step === 1
      ? t('steps.step1Title')
      : draft.step === 2
        ? t('steps.step2Title')
        : t('steps.step3Title');

  const errorList = Object.entries(fieldErrors);

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:space-y-0">
      {/* Left column on desktop / Top chip on mobile */}
      <aside aria-label="Session info" className="space-y-4 lg:sticky lg:top-6 lg:col-span-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-col lg:items-start lg:gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] lg:text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              <span>
                {t('header.classChip', { moment: chipMoment, tz: APP_CONFIG.TIMEZONE_LABEL })}
              </span>
            </div>
            {session.topic && (
              <span className="rounded-lg bg-[var(--primary)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--primary)] lg:px-3 lg:py-1.5 lg:text-sm">
                💬 {session.topic}
              </span>
            )}
          </div>

          <ol aria-hidden="true" className="mt-5 hidden space-y-2.5 border-t border-[var(--border)] pt-5 lg:block">
            {([
              [1, t('steps.step1Title')],
              [2, t('steps.step2Title')],
              [3, t('steps.step3Title')],
            ] as const).map(([num, label]) => {
              const current = draft.step === num;
              const completed = draft.step > num;
              return (
                <li
                  key={num}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    current
                      ? 'border border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--text)]'
                      : completed
                        ? 'text-[var(--text)]'
                        : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      current
                        ? 'bg-[var(--primary)] text-white'
                        : completed
                          ? 'bg-[var(--accent)] text-[#121214]'
                          : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {completed ? '✓' : num}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {beforeClassStart && (
          <div
            role="note"
            className="rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2.5 text-xs text-[var(--text)] lg:p-4"
          >
            💡 {t('header.beforeStartNote')}
          </div>
        )}

        {nextSession && (
          <div className="hidden lg:block">
            <NextClassCard session={nextSession} />
          </div>
        )}
      </aside>

      {/* Right column on desktop / Main form on mobile */}
      <div className="space-y-4 lg:col-span-7">
        {rateLimitSec !== null && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-[var(--text)]"
          >
            <p className="font-bold">{t('states.rateLimitedTitle')}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t('states.rateLimitedBody', { seconds: rateLimitSec })}
            </p>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/60 bg-red-500/10 p-4 text-sm text-[var(--text)]"
          >
            <p className="font-bold">{t('states.serverErrorTitle')}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('states.serverErrorBody')}</p>
          </div>
        )}

        <form
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-7"
        >
        {/* Step progress bar & heading */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <h1
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-lg font-bold text-[var(--text)] outline-none"
          >
            {stepTitle}
          </h1>
          <span
            aria-label={`Step ${draft.step} of 3`}
            className="rounded-full bg-[var(--bg)] px-3 py-1 text-xs font-bold text-[var(--primary)]"
          >
            {t('steps.progress', { step: draft.step })}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-colors ${
                s <= draft.step ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Accessible error summary when validation fails */}
        {errorList.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-xl border border-[var(--danger)] bg-[var(--bg)] p-3 text-xs text-[var(--danger)]"
          >
            <p className="font-semibold text-[var(--text)]">{t('fields.errorSummaryTitle')}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {errorList.map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Honeypot field (hidden from humans and assistive tech) */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor={`${baseId}-website`}>Website</label>
          <input
            id={`${baseId}-website`}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={websiteHoneypot}
            onChange={(e) => setWebsiteHoneypot(e.target.value)}
          />
        </div>

        {draft.step === 1 && (
          <div className="space-y-5">
            {prefilledEmail && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs">
                <span className="truncate text-[var(--text-secondary)]">
                  👋 {t('fields.prefilledNote', { email: prefilledEmail })}
                </span>
                <button
                  type="button"
                  onClick={handleResetReturning}
                  className="min-h-11 shrink-0 px-2 font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  {t('fields.notYou')}
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor={`${baseId}-email`}
                className="mb-1.5 block text-sm font-semibold text-[var(--text)]"
              >
                {t('fields.email')}
              </label>
              <input
                id={`${baseId}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t('fields.emailPlaceholder')}
                value={draft.email}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? `${baseId}-email-error` : undefined}
                onChange={(e) => {
                  updateDraft({ email: e.target.value });
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNext();
                  }
                }}
                className={`min-h-12 w-full rounded-2xl border bg-[var(--bg)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                  fieldErrors.email ? 'border-red-400' : 'border-[var(--border)]'
                }`}
              />
              {emailSuggestion && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft({ email: emailSuggestion });
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.email;
                        return copy;
                      });
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--primary)]/50 bg-[var(--primary)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--primary)]/25"
                  >
                    ✨ {t('fields.didYouMean', { suggestion: emailSuggestion })}
                  </button>
                </div>
              )}
              {fieldErrors.email && (
                <p
                  id={`${baseId}-email-error`}
                  role="alert"
                  className="mt-1.5 text-sm font-medium text-[var(--danger)]"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <CountryCombobox
              value={draft.country}
              onChange={(code) => {
                updateDraft({ country: code });
                if (fieldErrors.country) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.country;
                    return copy;
                  });
                }
              }}
              error={fieldErrors.country}
            />

            <fieldset className="space-y-2">
              <legend className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <span>{t('fields.role')}</span>
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  ({t('fields.optional')})
                </span>
              </legend>
              <div className="grid grid-cols-1 gap-2 pt-1">
                {ROLE_CHOICES.map((r) => {
                  const selected = draft.role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateDraft({ role: selected ? null : r })}
                      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                        selected
                          ? 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)] ring-2 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary)]/60'
                      }`}
                    >
                      <span>{t(`fields.roleOptions.${r}`)}</span>
                      <span aria-hidden="true">{selected ? '●' : '○'}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {draft.step === 2 && (
          <div className="space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[var(--text)]">{t('fields.speaking')}</legend>
              <p className="text-xs text-[var(--text-secondary)]">{t('fields.speakingHint')}</p>
              <div role="radiogroup" aria-label={t('fields.speaking')} className="grid grid-cols-1 gap-2 pt-1">
                {SPEAKING.map((sp) => {
                  const checked = draft.speaking === sp;
                  return (
                    <button
                      key={sp}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => {
                        updateDraft({ speaking: sp });
                        if (fieldErrors.speaking) {
                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.speaking;
                            return copy;
                          });
                        }
                      }}
                      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                        checked
                          ? 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)] ring-2 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary)]/60'
                      }`}
                    >
                      <span>{t(`fields.speakingOptions.${sp}`)}</span>
                      <span aria-hidden="true">{checked ? '●' : '○'}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.speaking && (
                <p role="alert" className="text-sm font-medium text-[var(--danger)]">
                  {fieldErrors.speaking}
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <span>{t('fields.level')}</span>
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  ({t('fields.optional')})
                </span>
              </legend>
              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                {LEVELS.map((lv) => {
                  const selected = draft.level === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateDraft({ level: selected ? null : lv })}
                      className={`flex min-h-11 items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                        selected
                          ? 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)] ring-2 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary)]/60'
                      }`}
                    >
                      <span>{t(`fields.levelOptions.${lv}`)}</span>
                      <span aria-hidden="true">{selected ? '●' : '○'}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <RatingRadioGroup
              value={draft.rating}
              onChange={(rating) => {
                updateDraft({ rating });
                if (fieldErrors.rating) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.rating;
                    return copy;
                  });
                }
              }}
              error={fieldErrors.rating}
            />
          </div>
        )}

        {draft.step === 3 && (
          <div className="space-y-5">
            {session.requireKeyword && (
              <div>
                <label
                  htmlFor={`${baseId}-keyword`}
                  className="mb-1 block text-sm font-semibold text-[var(--text)]"
                >
                  {t('fields.keyword')}
                </label>
                <p id={`${baseId}-keyword-hint`} className="mb-2 text-xs text-[var(--text-secondary)]">
                  🔑 {t('fields.keywordHint')}
                </p>
                <input
                  id={`${baseId}-keyword`}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={LIMITS.keywordMax}
                  placeholder={t('fields.keywordPlaceholder')}
                  value={draft.keyword}
                  aria-invalid={Boolean(fieldErrors.keyword)}
                  aria-describedby={
                    fieldErrors.keyword
                      ? `${baseId}-keyword-hint ${baseId}-keyword-error`
                      : `${baseId}-keyword-hint`
                  }
                  onChange={(e) => {
                    updateDraft({ keyword: e.target.value });
                    if (fieldErrors.keyword) {
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.keyword;
                        return copy;
                      });
                    }
                  }}
                  className={`min-h-12 w-full rounded-2xl border bg-[var(--bg)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                    fieldErrors.keyword ? 'border-red-400' : 'border-[var(--border)]'
                  }`}
                />
                {fieldErrors.keyword && (
                  <p
                    id={`${baseId}-keyword-error`}
                    role="alert"
                    className="mt-1.5 text-sm font-medium text-[var(--danger)]"
                  >
                    {fieldErrors.keyword}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor={`${baseId}-comment`}
                className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"
              >
                <span>{t('fields.comment')}</span>
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  ({t('fields.optional')})
                </span>
              </label>
              <p id={`${baseId}-comment-hint`} className="mb-2 text-xs text-[var(--text-secondary)]">
                {t('fields.commentHint')}
              </p>
              <textarea
                id={`${baseId}-comment`}
                rows={3}
                maxLength={LIMITS.commentMax}
                aria-describedby={`${baseId}-comment-hint`}
                placeholder={t('fields.commentPlaceholder')}
                value={draft.comment}
                onChange={(e) => updateDraft({ comment: e.target.value })}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              />
            </div>

            <div>
              <label
                htmlFor={`${baseId}-topic`}
                className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"
              >
                <span>{t('fields.topic')}</span>
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  ({t('fields.optional')})
                </span>
              </label>
              <p id={`${baseId}-topic-hint`} className="mb-2 text-xs text-[var(--text-secondary)]">
                {t('fields.topicHint')}
              </p>
              <input
                id={`${baseId}-topic`}
                type="text"
                maxLength={LIMITS.topicMax}
                aria-describedby={`${baseId}-topic-hint`}
                placeholder={t('fields.topicPlaceholder')}
                value={draft.topicSuggestion}
                onChange={(e) => updateDraft({ topicSuggestion: e.target.value })}
                className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {draft.step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep(draft.step === 3 ? 2 : 1)}
              className="min-h-12 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]"
            >
              ← {t('steps.back')}
            </button>
          ) : (
            <span />
          )}

          {draft.step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="min-h-12 flex-1 rounded-2xl bg-[var(--primary)] px-6 py-3 text-base font-bold text-white shadow-md hover:opacity-95 sm:flex-initial"
            >
              {t('steps.next')} →
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting || rateLimitSec !== null}
              className="min-h-12 flex-1 rounded-2xl bg-[var(--accent)] px-6 py-3 text-base font-bold text-[#121214] shadow-md hover:opacity-95 disabled:opacity-50 sm:flex-initial"
            >
              {submitting ? t('steps.submitting') : t('steps.submit')}
            </button>
          )}
        </div>
        </form>
      </div>
    </div>
  );
}
