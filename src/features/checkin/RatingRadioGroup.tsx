import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RATINGS, type Rating } from '../../../shared/constants';

const FACES: Record<Rating, string> = {
  1: '😕',
  2: '🙂',
  3: '😊',
  4: '😄',
  5: '🤩',
};

interface RatingRadioGroupProps {
  value: Rating | null;
  onChange: (rating: Rating) => void;
  error?: string;
}

export function RatingRadioGroup({ value, onChange, error }: RatingRadioGroupProps) {
  const { t } = useTranslation();
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-2">
      <legend className="text-sm font-semibold text-[var(--text)]">{t('fields.rating')}</legend>
      <p className="text-xs text-[var(--text-secondary)]">{t('fields.ratingAnchors')}</p>
      <div role="radiogroup" aria-label={t('fields.rating')} className="grid grid-cols-5 gap-2 pt-1">
        {RATINGS.map((r) => {
          const checked = value === r;
          const label = t(`fields.ratingLabels.${r}`);
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={label}
              onClick={() => onChange(r)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const next = RATINGS[Math.min(RATINGS.length - 1, RATINGS.indexOf(r) + 1)]!;
                  onChange(next);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const prev = RATINGS[Math.max(0, RATINGS.indexOf(r) - 1)]!;
                  onChange(prev);
                }
              }}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border p-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                checked
                  ? 'border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--text)] ring-2 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--primary)]/60'
              }`}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {FACES[r]}
              </span>
              <span className="mt-1 text-xs font-bold text-[var(--text)]">{r}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
