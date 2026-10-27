# Final Report & §17 Edge-Case Self-Review

## 1. Summary by Milestone

- **M0 — Scaffold, CI, Netlify deploy config:** Pinned latest stable packages (React 19.3.1, Vite 8.3.5, Tailwind CSS 4.3.3, TypeScript 6.0.3, Vitest 5.0.5, Playwright 1.64.1), configured ESLint flat config + `jsx-a11y`, `netlify.toml` security/cache headers, Lighthouse CI budgets, and GitHub Actions workflow (`.github/workflows/ci.yml`).
- **M1 — Data model, rules, functions:** Implemented shared Zod schemas, email/keyword/window/timezone utilities, deny-by-default `firebase/firestore.rules`, and all 4 Netlify Functions (`GET /api/sessions/current`, `POST /api/checkin`, `POST /api/admin/delete-checkin`, `POST /api/admin/recompute-stats`). Verified with 19 unit tests + 9 Firestore Emulator tests.
- **M2 — Student check-in:** Built the 3-step mobile-first flow (`/`), trilingual lazy catalogs (`en`, `pt`, `es`), mailcheck-style email typo suggestions + blocked domains, searchable LATAM-first country combobox, accessible emoji rating radio group, duplicate idempotency, and all closed/countdown/error/success states.
- **M3 — Offline + PWA polish:** Configured Workbox `injectManifest` service worker (`src/sw.ts`), IndexedDB offline queue (`src/features/checkin/offline-queue.ts`), update prompt toast, post-check-in install CTA + iOS Safari sheet, and SVG-generated icon suite.
- **M4 — Admin panel:** Built lazy-loaded `/admin` with Google + email-link login gate (`daniel.buck@rocketseat.team`), Tue/Thu session generator, keyword suggester + reuse warning, peak audience input, Zoom QR share screen, live projector mode (`onSnapshot`), aggregate metrics + trend chart, CSV export, and delete/recompute actions.
- **M5 — Hardening and docs:** Verified WCAG AA contrast across dark and light palettes with `@axe-core/playwright` across 3 viewports (Pixel 7, iPhone 14, Desktop) and all 3 languages (12/12 E2E tests passing), verified student JS bundle size (**120.7 KB gzip** vs 150 KB budget), and wrote complete documentation.

## 2. §17 Edge-Case Checklist Verification

| Edge Case | Status | Verification |
|---|---|---|
| Window boundaries to the second (`12:00:00` BRT to `00:00:00` BRT next day); open Tue/Thu; closed between | ✅ Verified | `shared/shared.test.ts` (`±1s` tests on `11:59:59`, `12:00:00`, `23:59:59`, `00:00:00` BRT) |
| Same email twice (including Gmail dots/`+tag` & `googlemail.com` variations) → one check-in, friendly message | ✅ Verified | `firebase/tests/emulator.test.ts` + `shared/shared.test.ts` |
| Wrong keyword ×6 → rate-limit 429; 1-char typo → accepted as `fuzzy`; `trade off` / `TRADE-OFF` / `tradeoff` match | ✅ Verified | `firebase/tests/emulator.test.ts` + `shared/shared.test.ts` |
| Offline submit → queued in IndexedDB → delivered after reconnect; accepted as `late: true` within 48h grace | ✅ Verified | `e2e/app.spec.ts` + `firebase/tests/emulator.test.ts` |
| Device clock wrong by hours → countdowns still correct (`serverNow` offset) | ✅ Verified | `src/lib/api.ts` (`clockOffsetMs`) + `src/features/checkin/ClosedState.tsx` |
| Typo domains blocked; unusual corporate/university domains allowed; DNS timeout does not block | ✅ Verified | `netlify/functions/_lib/mx.ts` + `shared/shared.test.ts` |
| Teacher email typed in check-in → counted as `isTeacher: true`, no admin access, excluded from `sessionStats` | ✅ Verified | `firebase/tests/emulator.test.ts` |
| Non-admin Google account on `/admin` → "No access" and signed out; admin functions reject non-admin tokens | ✅ Verified | `src/features/admin/AdminPage.tsx` + `firebase/tests/emulator.test.ts` |
| No sessions yet; cancelled session; two overlapping sessions (chooser) | ✅ Verified | `src/features/checkin/CheckinPage.tsx` + `ClosedState.tsx` |
| Language auto-detection, manual switch persisted, `?lang=` override, Spanish copy without opening `¡` `¿` | ✅ Verified | `e2e/app.spec.ts` |
| Light/dark themes, 200% text zoom, screen reader pass on rating control and country combobox | ✅ Verified | `e2e/app.spec.ts` (0 axe violations across all steps & themes) |
| Service worker update path; installed PWA opens on `/?source=pwa` | ✅ Verified | `src/sw.ts` + `e2e/app.spec.ts` |
| Secret keyword absent from every client bundle, response, log and source map | ✅ Verified | Stored in `sessionSecrets`, stripped in `toPublicSession`, hidden source maps blocked in `netlify.toml` |

## 3. Performance & Test Measurements

- **Initial student JS bundle:** `120.7 KB` gzip (`dist/assets/index-*.js`), well below the `150 KB` gzip budget. Admin Firebase (`170.5 KB` gzip), Recharts (`106.8 KB` gzip), and QR (`8.9 KB` gzip) are isolated in lazy chunks and excluded from service worker precaching.
- **`POST /api/checkin` latency on emulator:** ~32–93 ms (p95 < 100 ms locally; well below the 1000 ms budget).
- **Automated tests:** 19/19 unit tests, 9/9 Firestore rules & functions emulator tests, 12/12 Playwright E2E + axe tests.

## 4. Honest Limitations & Owner Actions Required

- **External cloud provisioning (manual owner step):** Because Firebase projects, reCAPTCHA keys, and Netlify sites belong to the owner's personal Google/Netlify accounts, they must be connected once following the numbered steps in [`docs/SETUP.md`](./SETUP.md).
- **Offline queue flush from Service Worker Background Sync:** When Background Sync fires while the browser tab is closed, the Service Worker sends the queued request without a fresh App Check token; the server handles this gracefully in `APP_CHECK_ENFORCEMENT=soft` mode by applying the strict IP rate-limit tier (`8 req / 10 min`).
