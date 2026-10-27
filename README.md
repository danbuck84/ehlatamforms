# EnglishTalk 🌎

**English Hub Rocketseat | LATAM English Conversation** — mobile-first, trilingual (EN / PT-BR / ES-419), offline-capable PWA that replaces the Google Forms attendance check-in for Teacher Dan's Tuesday & Thursday live conversation classes.

## Highlights

- **One permanent URL & QR code:** Automatically detects the open class on the server (`America/Sao_Paulo`, UTC−3).
- **12-hour check-in window:** Opens **6 hours before** class (`12:00` BRT) and closes **6 hours after** class start (`00:00` BRT of the following day) for an `18:00` BRT session. Both offsets are configurable per session.
- **Smart email & keyword validation:** Mailcheck-style typo suggestions (`gmial.com → gmail.com`), blocks known-bad typo domains, normalizes Gmail dots/`+tags` for deduplication, and validates the secret keyword on the server (case/accent/hyphen-insensitive + 1-edit Damerau–Levenshtein fuzzy match).
- **Offline queue:** Saves submissions in IndexedDB when offline and flushes automatically when reconnected (accepting captures inside the window up to 48h after close as `late: true`).
- **Teacher Admin (`/admin`):** Google + email-link login gate (`daniel.buck@rocketseat.team`), Tue/Thu session generator, keyword suggester with reuse warning, Zoom QR share screen, live projector mode, metrics, CSV export, and stats repair.

## Quick Start (Local Development)

```bash
# Install dependencies
pnpm install

# Start local Firestore & Auth emulators (in terminal 1)
pnpm emulators

# Seed sample sessions into the emulator (in terminal 2)
pnpm seed

# Start Vite + Netlify Functions dev server
pnpm dev
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run Vite dev server with Netlify Functions emulation |
| `pnpm build` | Typecheck, bundle client + service worker |
| `pnpm test` | Run Vitest unit tests (window, email, keyword, time, schemas, CSV) |
| `pnpm test:emulator` | Run Firestore Security Rules + Netlify Functions tests on the Firebase Emulator |
| `pnpm test:e2e` | Run Playwright E2E + `@axe-core/playwright` accessibility tests across Pixel 7, iPhone 14 & Desktop |
| `pnpm lint` | Run ESLint (flat config + `typescript-eslint` + `jsx-a11y`) |
| `pnpm typecheck` | Run `tsc -b --noEmit` |

## Documentation

- [Implementation Plan](./docs/PLAN.md)
- [Step-by-Step Setup & Deployment Guide](./docs/SETUP.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Firestore Data Model](./docs/DATA_MODEL.md)
- [Trilingual Copy Review](./docs/COPY_REVIEW.md)
- [Architecture Decision Records](./docs/adr/)
- [Source Brief (with 12h window correction)](./docs/BRIEF.md)
