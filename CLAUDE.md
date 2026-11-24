# EnglishTalk (English Hub LATAM app)

## What this is

Mobile-first, trilingual (EN / PT-BR / ES-419) offline-capable PWA that replaces the Google Forms attendance check-in
for Teacher Dan's English Hub live classes (Tue & Thu, 18:00–19:00 BRT). Students scan one permanent QR code, check in
with email + a secret keyword announced at the end of class, rate the class, comment and suggest topics. Teacher admin
at /admin: sessions, keywords, QR share screen, live projector view, metrics, CSV export. Attendance streak is implemented.
Not implemented yet: topic voting (Dan plans to design it in a separate chat; confirm before building).
Production: https://ehlatamforms.netlify.app/. It is the live system now; Google Forms is no longer used.
Planned: migration to the Rocketseat platform later. Keep code portable and data export-friendly.

## Owner

Dan is not a professional developer. Explain in plain language, say what a change does and what could break.
Reply in Portuguese unless asked otherwise; code, commits and docs stay in English.

## Stack

React 19 + TypeScript (strict) + Vite 8 + Tailwind 4, react-router, react-hook-form + zod, i18next, Recharts, Workbox PWA
(injectManifest, autoUpdate), IndexedDB offline queue. Netlify Functions v2 (Web Request/Response) + Firebase Admin SDK +
Firestore (southamerica-east1) + Firebase Auth (admin only) + App Check (soft). pnpm, Node >= 22.

## Layout

- src/ client (features/checkin, features/admin, i18n, lib, sw.ts)
- netlify/functions/ API (4 endpoints) and _lib/ business logic
- shared/ code used by client AND server (window, email, keyword, time, schemas, csv) + unit tests
- firebase/ rules, indexes, emulator tests
- docs/ PLAN, ARCHITECTURE, DATA_MODEL, SETUP, REPORT, adr/ (read before changing core behavior)

## Commands

pnpm install | pnpm dev | pnpm emulators | pnpm seed | pnpm test | pnpm test:emulator | pnpm test:e2e |
pnpm lint | pnpm typecheck | pnpm build
Emulators need Java 21. It is installed via Homebrew but not on PATH; prefix commands with
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH".
Before committing: typecheck, lint, test (and test:emulator if rules/functions changed).

## Git and deploy

- Dan has authorized committing and pushing directly to main without asking each time. Still run the checks above first
  and tell Dan what was pushed.
- A push to main DEPLOYS TO PRODUCTION via Netlify. Never push failing typecheck/lint/tests.
- Firestore rules/indexes are NOT deployed by Netlify. Deploy manually:
  npx firebase-tools deploy --only firestore --config firebase/firebase.json --project <id>
  (changing rules in production still needs Dan's OK; no .firebaserc, project id must be passed).
- Env vars live only in Netlify (see .env.example for names). Never print, log or commit values.
- Conventional Commits.

## Conventions

- Exact pinned dependency versions; ask before adding or upgrading packages. Student entry bundle must stay <= 150 KB gzip.
- Every user-facing string goes in all three catalogs (en, pt, es). Spanish without opening ¡ ¿ per docs/COPY_REVIEW.md.
- Dates: native Intl only (no date libs); store UTC, class timezone America/Sao_Paulo.
- Accessibility (axe, WCAG AA) must keep passing.
- Students never touch Firestore directly; all writes go through Netlify Functions.

## Design decisions (see docs/adr)

12h check-in window (opens 6h before, closes 6h after start; per-session override). Secret keyword only on the server,
fuzzy match (1 edit). One check-in per student per session (Gmail dots/+tags normalized). Offline submissions accepted
as late for up to 48h. Teacher email is excluded from stats.

## Ask Dan before touching

- firebase/firestore.rules, netlify.toml (CSP/headers), auth and admin allowlist, App Check mode
- Any env var or secret, HASH_PEPPER, service-account handling
- Check-in window defaults, keyword logic, email dedup, data model fields
- Anything that deletes or exports student data, or edits production data
- Anything that could break the live check-in on class days (Tue/Thu, window 12:00 to 00:00 BRT); this app is the only attendance system

## Privacy

Check-ins store student emails, country and comments. Never put real student data (or CSV exports) in prompts, logs,
docs or tests. Never show secrets or .env contents.

## Known gaps / TODO

- Docs outdated on SW update mode (code uses autoUpdate; PLAN.md and ADR 0001 say prompt)
- No data retention / deletion policy (LGPD) yet; idea: strip emails from checkins after ~12 months, keep aggregates
- App Check still soft; Background Sync sends no App Check token
- Recent features (streak, radar, admin metrics) lack tests; local .env exists (git-ignored, emulator-only demo values)
- Topic voting not built; Rocketseat migration plan not defined
