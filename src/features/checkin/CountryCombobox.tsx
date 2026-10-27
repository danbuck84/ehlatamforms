import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCountryOptions, flagEmoji } from '../../../shared/country';
import type { CountryCode } from '../../../shared/constants';
import { foldText } from '../../../shared/text';

interface CountryComboboxProps {
  value: CountryCode | '';
  onChange: (code: CountryCode) => void;
  error?: string;
}

export function CountryCombobox({ value, onChange, error }: CountryComboboxProps) {
  const { t, i18n } = useTranslation();
  const baseId = useId();
  const inputId = `${baseId}-country-input`;
  const listboxId = `${baseId}-country-listbox`;
  const errorId = `${baseId}-country-error`;

  const locale = i18n.language === 'pt' ? 'pt-BR' : i18n.language === 'es' ? 'es-419' : 'en-US';
  const options = useMemo(() => buildCountryOptions(locale), [locale]);
  const selected = useMemo(() => options.find((o) => o.code === value) ?? null, [options, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = foldText(query.trim());
    if (!q) return options;
    return options.filter(
      (o) => foldText(o.name).includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectOption = (code: CountryCode) => {
    onChange(code);
    setQuery('');
    setOpen(false);
  };

  const displayValue = open ? query : selected ? `${flagEmoji(selected.code)} ${selected.name}` : '';

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-[var(--text)]">
        {t('fields.country')}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex] ? `${baseId}-opt-${filtered[activeIndex].code}` : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholder={t('fields.countryPlaceholder')}
          value={displayValue}
          onFocus={() => {
            setQuery('');
            setActiveIndex(0);
            setOpen(true);
          }}
          onClick={() => {
            if (!open) {
              setQuery('');
              setActiveIndex(0);
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onBlur={() => {
            // Delay so option click registers before closing
            setTimeout(() => {
              setOpen(false);
              setQuery('');
            }, 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              const item = filtered[activeIndex];
              if (item) selectOption(item.code);
            } else if (e.key === 'Escape' && open) {
              e.preventDefault();
              setOpen(false);
              setQuery('');
            }
          }}
          className={`min-h-12 w-full rounded-2xl border bg-[var(--bg)] px-4 py-3 pr-10 text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
            error ? 'border-red-400' : 'border-[var(--border)]'
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={t('fields.country')}
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) {
              setOpen(false);
            } else {
              inputRef.current?.focus();
            }
          }}
          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--text-secondary)]"
        >
          ▾
        </button>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('fields.country')}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">{t('fields.countryEmpty')}</li>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = opt.code === value;
              const isActive = idx === activeIndex;
              return (
                <li
                  key={opt.code}
                  id={`${baseId}-opt-${opt.code}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt.code);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-base ${
                    isActive
                      ? 'bg-[var(--primary)] text-white'
                      : isSelected
                        ? 'bg-[var(--bg)] font-semibold text-[var(--text)]'
                        : 'text-[var(--text)]'
                  }`}
                >
                  <span>
                    <span aria-hidden="true" className="mr-2">
                      {flagEmoji(opt.code)}
                    </span>
                    {opt.name}
                  </span>
                  <span className={`text-xs ${isActive ? 'text-white/90' : 'text-[var(--text-secondary)]'}`}>
                    {opt.code}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
