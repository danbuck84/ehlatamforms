# Architecture Overview

```text
Browser (PWA, React 19 SPA)
   │  GET  /api/sessions/current        (public, NetworkFirst cached for display)
   │  POST /api/checkin                  (public, App Check + IP & keyword rate limited)
   │  admin: Firebase Auth (Google / Email Link) → Firestore (rules) + admin functions
   ▼
Netlify Functions (Firebase Admin SDK)  ──►  Firestore (southamerica-east1)
```

## Core Principles

1. **Zero direct student Firestore access:** Students never read or write to Firestore directly. All student check-ins go through `POST /api/checkin` and session discovery goes through `GET /api/sessions/current`. `firebase/firestore.rules` denies all unauthenticated reads and writes, and forbids client writes to `checkins`, `students`, `sessionStats`, and `rateLimits` even for admins.
2. **Secret keyword isolation:** The secret keyword is stored in `sessionSecrets/{sessionId}` (admin-only collection). It is never returned by `GET /api/sessions/current`, never logged, and compared on the server using a SHA-256 `timingSafeEqual` comparison after NFD normalization and compacting (`TRADE-OFF`, `trade off`, and `tradeoff` all match, plus optional Damerau–Levenshtein distance $\le 1$ when `fuzzy: true` and length $\ge 5$).
3. **Server clock authority & 12-hour window:** Open/closed state is always derived on the server (`opensAt <= serverNow < closesAt`). By default, check-in opens **6 hours before** `startsAt` (**12:00 BRT**) and closes **6 hours after** `startsAt` (**00:00 BRT** of the next day), totaling **12 hours**. `GET /api/sessions/current` returns `serverNow` so client countdowns stay accurate even when the device clock is wrong.
4. **Denormalized aggregates for Spark plan efficiency:** Each non-teacher check-in updates `sessionStats/{sessionId}` and `students/{emailKey}` inside the same Firestore transaction as `checkins/{sessionId}__{emailKey}`, keeping dashboard reads tiny and well within Firebase Spark (free) tier quotas.
5. **Offline-first resilience:** If `POST /api/checkin` fails due to network loss, the payload (including `clientSubmissionId` UUID and `clientCapturedAt`) is stored in IndexedDB (`englishtalk-queue`) and flushed automatically on `online`, `visibilitychange`, app start, and Service Worker Background Sync. Submissions captured inside the window and delivered within 48 hours after `closesAt` are accepted with `late: true`.
