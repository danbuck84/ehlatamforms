# EnglishTalk — implementation plan

Source of truth: [BRIEF.md](./BRIEF.md) (owner correction: **12 h check-in window**, 6 h before → 6 h after the class start).

Status legend: ☐ todo · ◐ in progress · ☑ done

## M0 — Scaffold, CI, Netlify deploy
- ☑ Verify latest stable versions on npm and pin them (see ADR 0001)
- ☑ Vite + React + TS strict + Tailwind v4 + PWA plugin scaffold
- ☑ ESLint flat config + Prettier, `.nvmrc`, pnpm scripts
- ☑ `netlify.toml` (SPA fallback that does not shadow `/api/*`), security + cache headers
- ☑ GitHub Actions CI (typecheck, lint, unit, emulator tests, build, e2e, Lighthouse CI, audit)
- ☐ Netlify site connected (owner action, see SETUP.md)

## M1 — Data model, rules, functions
- ☑ `shared/`: Zod schemas, constants, email / keyword / window / time logic + unit tests
- ☑ `firebase/firestore.rules` deny-by-default + rules tests (emulator)
- ☑ `firestore.indexes.json`, TTL policy documentation for `rateLimits.expiresAt`
- ☑ Functions: `GET /api/sessions/current`, `POST /api/checkin`, `POST /api/admin/delete-checkin`, `POST /api/admin/recompute-stats`
- ☑ Functions tests on the Firestore emulator (valid, duplicate, closed, not-yet-open, wrong keyword + rate limit, fuzzy, teacher, stats, delete, non-admin, late grace)

## M2 — Student check-in
- ☑ 3-step flow, header class chip, draft autosave, returning-student prefill
- ☑ Email typo suggestions + blocked domains, country combobox (Intl.DisplayNames, LATAM first, tz guess)
- ☑ Speaking / level / rating cards, keyword step, all states (loading, open, not-yet-open, closed, none, cancelled, offline, error, rate-limited, success)
- ☑ i18n EN / PT / ES with lazy catalogs, `?lang=` override, persisted switcher

## M3 — Offline + PWA polish
- ☑ IndexedDB offline queue (online / visibilitychange / start / Background Sync flush)
- ☑ Manifest, icons from SVG logo, update toast (`registerType: "prompt"`), offline fallback
- ☑ Install CTA after success, iOS instructions sheet, safe-area / 16px inputs

## M4 — Admin panel
- ☑ Google + email-link sign-in, allowlist gate, sign-out for non-admins
- ☑ Sessions list / create / edit / cancel, Tue/Thu generator, keyword with suggest + reuse warning, peak audience
- ☑ Share (QR + link), live projector view, metrics, comments / topics, CSV export, delete + recompute

## M5 — Hardening and docs
- ☑ Budgets (Lighthouse CI), axe in all languages, rate limits + App Check soft/strict
- ☑ README, SETUP, ARCHITECTURE, DATA_MODEL, COPY_REVIEW, ADRs
- ☑ Final self-review against §17 (see REPORT.md)
