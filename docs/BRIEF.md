# EnglishTalk — build brief (source of truth)

> Converted from the owner's brief. **Owner correction applied:** the check-in window is **12 h** (opens 6 h before the class start and closes 6 h after it → 12:00 to 00:00 BRT for an 18:00 class), not 24 h.

```text
EnglishTalk — build brief for Antigravity
Working name: EnglishTalk (kept in a single config file so it can be renamed in one minute). A mobile-first, installable PWA that replaces the Google Forms attendance check-in of English Hub Rocketseat | LATAM English Conversation.


0. How to work (read this first)
	•	You are building a production app end to end: plan → implement → test → deploy config → docs.
	•	First action: write an implementation plan (docs/PLAN.md) with the milestones in §16 and a task list. Then execute it without waiting for approval, unless you hit something marked [ASK].
	•	Use the latest stable versions of everything and the most current recommended practices. Do NOT trust your memory for versions or APIs. At the start, check the npm registry and the official docs for: React, Vite, Tailwind CSS, vite-plugin-pwa / Workbox, React Router, Firebase Web SDK, Firebase Admin SDK, Netlify Functions, Playwright, Vitest, i18next. Pin what you find. If the docs contradict your assumptions, the docs win. If a library below is deprecated or unmaintained, choose the maintained successor and record it in docs/adr/.
	•	Prefer boring, well-supported solutions over clever ones. Every non-obvious decision gets a short ADR (3–5 lines) in docs/adr/.
	•	Commit often using Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:), imperative mood, lowercase subject, max 72 chars (e.g. feat: add check-in window logic). Every milestone ends with green CI and a tagged commit.
	•	Never commit secrets. Anything that needs the owner's manual action (creating the Firebase project, setting env vars, etc.) goes into docs/SETUP.md as numbered steps written for someone who has never configured Firebase or Netlify. At the end of each milestone, print an "Owner actions required" list.
	•	When something is ambiguous, pick the simpler option, document it, and keep going.
	•	At the end, self-review against §17 and report honestly what is missing or weak.


1. Product context
	•	What: live English conversation classes on Zoom, 100% in English, taught by one teacher (Daniel "Teacher Dan" Buck).
	•	When: Tuesdays and Thursdays, 18:00–19:00 in America/Sao_Paulo (UTC−3, no daylight saving time).
	•	Who: about 15–30 students per class, from Brazil and Spanish-speaking Latin America. Audience: Rocketseat students, Digital House students, and DHRS employees. Most use phones; some have old Android devices and unstable mobile data.
	•	Emails: about 75% use Gmail, about 25% use Hotmail/Outlook/Yahoo/iCloud, corporate or university emails. Typos were common in the old system (gmial.com, hotrmail.com, hormail.com, hotmail.om, hmail.com).
	•	What it replaces: Google Forms + Google Sheets. Problems to solve: duplicate responses, email typos, students picking the wrong class, no country data, the secret keyword being checked by hand, the audience count typed by hand.
	•	Users: (a) students: anonymous, no accounts, ever; (b) admin: only the teacher.
	•	UI languages: English, Portuguese (Brazil) and Spanish (Latin America).
	•	Start fresh: do NOT import the legacy spreadsheet.


2. Scope
v1 (build now)

	•	Student check-in (auto-detects the current class, trilingual, offline-capable).
	•	Admin panel: create/edit sessions, set the secret keyword, enter peak audience, see live and aggregate metrics, export CSV.
	•	PWA: installable, offline-aware, update flow.

v1.1 (do NOT build, but keep the data model ready)

	•	"This is your 12th class! 🔥" streaks and gamification.
	•	Richer dashboards, push reminders.


3. Brand and visual design
	•	Central config in src/config/app.ts: APP_NAME = "EnglishTalk", short name, tagline, theme colors, timezone, default window offsets. Renaming must be a one-file change.
	•	Co-brand line: "English Hub Rocketseat | LATAM English Conversation 🌎".
	•	Dark-first, automatic light mode via prefers-color-scheme, manual toggle persisted.
	•	Design tokens (CSS variables): primary #8257E5, accent/success #04D361, dark background #121214, surface #202024, border #323238, text #E1E1E6, secondary text #A8A8B3. Make a light palette with equivalent contrast. All text must meet WCAG AA in both themes.
	•	Typography: Inter variable, self-hosted, subsets latin + latin-ext, font-display: swap.
	•	Feel: friendly, playful, confident. Rounded 16px cards, large touch targets, emoji-friendly copy, subtle CSS-only micro-interactions. Success screen with a lightweight CSS celebration (no heavy library). Respect prefers-reduced-motion.
	•	Generate a simple SVG logo (rocket + speech bubble) and all icon sizes from it.


4. Tech stack
Area
Choice
Package manager / runtime
pnpm, Node LTS (.nvmrc)
Language
TypeScript, strict, noUncheckedIndexedAccess
Build / UI
Vite + React (latest stable) + React Router
Styling
Tailwind CSS (latest) with design tokens; headless primitives (Radix UI or React Aria) only for hard-to-get-right a11y widgets (country combobox, dialog, toast)
Forms / validation
React Hook Form + Zod. Zod schemas live in shared/ and are used by both client and functions
Server state
TanStack Query
i18n
i18next + react-i18next + language detector, catalogs lazy-loaded per language
PWA
vite-plugin-pwa (Workbox), idb for IndexedDB
Firebase
Modular Web SDK (Firestore, Auth, App Check) on the client; Firebase Admin SDK inside Netlify Functions
Dates
Intl APIs plus a timezone-safe library (Luxon or date-fns-tz), or Temporal if stable in all target browsers at build time. Never parse local date strings with new Date("YYYY-MM-DD HH:mm"). Store and transmit UTC instants (ISO strings) only
Admin-only extras
lightweight charting lib (Recharts, visx or uPlot), client-side QR lib. Both lazy-loaded so the student bundle stays tiny
Quality
ESLint (flat config) + typescript-eslint + jsx-a11y, Prettier (or Biome)
Tests
Vitest + Testing Library, Playwright + @axe-core/playwright, Firebase Emulator Suite + @firebase/rules-unit-testing, Lighthouse CI
CI/CD
GitHub Actions; Netlify (static hosting + Functions in TypeScript using the current Functions API with Web-standard Request/Response; confirm in the docs)
Firebase plan
Spark (free). No Cloud Functions, nothing that requires Blaze


5. Architecture and data model
Browser (PWA, React SPA)
   │  GET  /api/sessions/current        (public)
   │  POST /api/checkin                  (public, App Check + rate limited)
   │  admin: Firebase Auth (Google) → Firestore (rules) + admin functions
   ▼
Netlify Functions (Firebase Admin SDK)  ──►  Firestore (southamerica-east1)

Principles

	•	Students NEVER write to Firestore directly. All check-ins go through POST /api/checkin, which validates everything on the server. Firestore rules deny all client writes to checkins, students, sessionStats.
	•	The secret keyword is never sent to any client except the admin. It lives in sessionSecrets (admin-only) and is compared on the server.
	•	The server clock is the only clock that matters. GET /api/sessions/current returns serverNow; the client uses it for countdowns.
	•	Aggregates are denormalized so the dashboard never reads thousands of documents (stay far below Spark free quotas).

Collections

// sessions/{sessionId}   sessionId = "2026-10-27" (add "-b" if two sessions share a day)
interface Session {
  startsAt: Timestamp;            // UTC instant
  endsAt: Timestamp;
  timezone: "America/Sao_Paulo";
  title?: string;
  topic?: string;                 // optional, shown to students
  opensOffsetMin: number;         // default 360  (minutes BEFORE startsAt)
  closesOffsetMin: number;        // default 360  (minutes AFTER startsAt)
  status: "scheduled" | "cancelled"; // open/closed is derived from time, never stored
  requireKeyword: boolean;        // default true
  peakAudience: number | null;    // typed by the teacher after class; excludes the teacher
  notes?: string;
  createdAt: Timestamp; updatedAt: Timestamp;
}

// sessionSecrets/{sessionId}     ADMIN ONLY
interface SessionSecret { keyword: string; fuzzy: boolean /* default true */ }

// checkins/{sessionId}__{emailKey}   deterministic id = one check-in per email per session
interface Checkin {
  sessionId: string;
  email: string;                  // lowercased as typed
  emailCanonical: string;         // see §7 (gmail dots / +tags removed)
  emailDomain: string;
  country: string;                // ISO 3166-1 alpha-2
  role: "rocketseat_student" | "digital_house_student" | "dhrs_team" | "other" | null;
  speaking: "a_lot" | "a_little" | "chat_only" | "listened";
  level: "too_easy" | "a_bit_easy" | "just_right" | "a_bit_hard" | "too_hard" | null;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;         // max 1000 chars
  topicSuggestion: string | null; // max 200 chars
  keywordMatch: "exact" | "fuzzy" | "not_required";
  uiLanguage: "en" | "pt" | "es";
  isTeacher: boolean;             // true when email is in ADMIN_EMAILS; excluded from metrics
  late: boolean;                  // offline submission accepted inside the grace period
  clientSubmissionId: string;     // uuid, for idempotent retries
  submittedAt: Timestamp;         // server time
  appVersion: string;
}

// students/{emailKey}            powers "returning students" now and "Nth class" in v1.1
interface Student { firstSeenAt: Timestamp; lastSeenAt: Timestamp; totalCheckins: number; lastCountry: string; emailDomain: string; isTeacher: boolean }

// sessionStats/{sessionId}       updated in the same transaction as the check-in
interface SessionStats { total: number; ratingSum: number; ratingCount: number;
  byCountry: Record<string, number>; bySpeaking: Record<string, number>;
  byLevel: Record<string, number>; byRole: Record<string, number>; byDomain: Record<string, number>; }

// rateLimits/{key}  with a Firestore TTL policy on `expiresAt`

emailKey = hex SHA-256 of emailCanonical.

Firestore rules: deny by default. Admin (Auth token email in the allowlist AND email_verified == true) can read everything and write sessions and sessionSecrets. Nobody else can read or write anything. Public data reaches students only through the functions. Rules must have automated tests.

Functions

Function
Access
Purpose
GET /api/sessions/current
public
returns { serverNow, open: Session[], next: Session | null } (never the keyword)
POST /api/checkin
public (App Check, rate limit)
full validation, window check, keyword check, transactional create + stats update
POST /api/admin/delete-checkin
admin (verified ID token)
deletes a check-in and fixes stats and student counters
POST /api/admin/recompute-stats
admin
rebuilds aggregates from raw check-ins (repair tool)

Admin CRUD for sessions and secrets can go straight to Firestore under the rules above.


6. Check-in window logic
	•	A session is open when opensAt <= serverNow < closesAt, where opensAt = startsAt − opensOffsetMin and closesAt = startsAt + closesOffsetMin. Defaults: 6 h before and 6 h after the class start, 12 h in total (12:00 → 00:00 BRT for an 18:00 class). Both offsets are editable per session.
	•	Open state is always derived from time, on the server. Never trust the client clock.
	•	Example for a class on Tue 2026-10-27 at 18:00 BRT (21:00Z): opens Tue 12:00 BRT, closes Wed 00:00 BRT (midnight).

Moment (BRT)
State
Tue 11:59:59
closed, "opens Tue 12:00"
Tue 12:00:00
open (inclusive)
Tue 19:30
open
Tue 23:59:59
open
Wed 00:00:00
closed (exclusive)

	•	With Tuesday/Thursday classes, windows never overlap. Closed gaps: Wed 00:00 → Thu 12:00 (36 h) and Fri 00:00 → Tue 12:00 (4 days 12 h). If an admin creates overlapping sessions, the student sees a chooser.
	•	Closed screen: friendly message, next class date/time shown in the student's local timezone and in Brasília time, and when the check-in opens. Countdown based on serverNow.
	•	Before startsAt (but inside the window), show a small note: "The secret keyword is announced at the end of the class." The page still works.
	•	Cancelled sessions never open.
	•	Offline grace: a submission queued while offline is accepted if clientCapturedAt falls inside the window and it reaches the server within 48 h after closesAt; store late: true. This is trust-based and acceptable.
	•	Unit-test the boundaries (±1 second), timezone display for BR/AR/CL/CO/PE/MX users, and offsets overrides.


7. Student experience (route /)
One permanent URL and QR code for every class (the app detects the class by time). No per-class links, no class dropdown.

Flow (mobile-first, one column, 3 short steps, progress "1/3")

	•	You: email, country, role (optional).
	•	Your class: how much you spoke, level of the conversation (optional), rating.
	•	Keyword and notes: secret keyword (required), comment (optional), topic suggestion (optional) → Submit.

Header chip always shows the detected class: "Tue, Oct 27 · 6 PM (Brasília)" + topic when present.

Behaviors

	•	Back keeps answers. Draft autosaved in sessionStorage, cleared on success. Enter advances.
	•	Returning student: email, country and role prefilled from localStorage with a "Not you?" reset. Used only for convenience.
	•	Email field: type="email", inputmode="email", autocomplete="email", autocapitalize="none", autocorrect="off", spellcheck="false".
	•	Email typo handling (mailcheck-style, non-blocking suggestion):
	•	Compare the domain against a list of common ones: gmail.com, hotmail.com, outlook.com, yahoo.com, yahoo.com.br, icloud.com, live.com, msn.com, proton.me, uol.com.br, bol.com.br, terra.com.br, hotmail.es, outlook.es, yahoo.es, plus TLD typos (.con, .cm, .om).
	•	Show "Did you mean maria@gmail.com?" as a tappable suggestion.
	•	Block submit for known-bad domains (gmial.com, gmai.com, gnail.com, hotrmail.com, hormail.com, homail.com, hmail.com, hotmail.om, outlok.com) until corrected.
	•	Unusual domains (corporate, university) are allowed. The server also checks that the domain has MX records, rejecting only on a definitive "no such domain/no MX"; DNS timeouts must NOT block the student.
	•	Email normalization: email = trimmed + lowercased. emailCanonical = for gmail.com/googlemail.com remove dots and +tag in the local part; for other domains strip +tag only. emailCanonical drives deduplication.
	•	Country: searchable combobox with localized names from Intl.DisplayNames. Latin American countries first (Brazil, Argentina, Chile, Colombia, Mexico, Peru, Uruguay, Ecuador, Bolivia, Paraguay, Venezuela, Costa Rica, Panama, Dominican Republic, Guatemala), then the rest A–Z. Pre-select a guess from the device timezone (e.g. America/Bogota → CO) but never submit it silently.
	•	Speaking, level, rating: big tap-friendly cards or segmented controls, not tiny radio buttons. Rating is a 1–5 radiogroup with emoji faces, accessible to screen readers.
	•	Keyword: compared on the server. Normalize both sides: lowercase, strip diacritics (NFD), and compare the compact form (remove spaces, hyphens, underscores, punctuation) so TRADE-OFF, trade off and tradeoff match. If the session secret has fuzzy: true and the compact keyword has 5+ characters, accept a Damerau–Levenshtein distance ≤ 1 and store keywordMatch: "fuzzy". Never reveal the keyword. A wrong keyword gives an inline, friendly error.
	•	Duplicates: a second submission for the same email and session returns success semantics ("You already checked in for this class ✅"), not an error. Idempotent on clientSubmissionId.
	•	Teacher email: if the typed email is in ADMIN_EMAILS, treat it as a normal check-in with isTeacher: true, excluded from metrics. It NEVER grants admin access.
	•	States to design: loading skeleton, open, not yet open, closed, no sessions yet, cancelled, offline, server error, rate limited, success.
	•	Success screen: thanks message (trilingual copy below), a lightweight celebration, a "Next class" card with the date in local time and Brasília time, an "Install app" call to action (see §10).
	•	Footer: one-line privacy note ("We store your email, country and answers only to track class attendance.") linking to a short /privacy page in all 3 languages.

Offline queue: if the submit fails because of no connection, save the payload (with clientSubmissionId and clientCapturedAt) in IndexedDB, show "Saved! We'll send it as soon as you're back online", and flush on the online event, on visibilitychange, on app start, and with Background Sync where supported.


8. Internationalization and copy
	•	Languages: en, pt (pt-BR), es (es-419). Detect from navigator.languages (any pt* → pt, any es* → es, else en). Manual switcher in the header, order EN | PT | ES, persisted. ?lang=es query param overrides.
	•	All strings in catalogs; no hardcoded text. Write natural, friendly, concise copy (not literal translations). Dates and numbers via Intl.
	•	Spanish style (deliberate choice of the owner): use only the closing ! and ?, without the opening ¡ and ¿.
	•	Approved copy for the form fields (EN / PT / ES):

Field
EN
PT
ES
Email
Email
E-mail
Correo electrónico
Country
Which country are you joining from?
De qual país você está participando?
Desde qué país te conectas?
Role
You are...
Você é...
Eres...
Role options
a Rocketseat student / a Digital House student / a DHRS team member
aluno(a) Rocketseat / aluno(a) Digital House / colaborador(a) DHRS
estudiante de Rocketseat / estudiante de Digital House / colaborador(a) DHRS
Speaking
How much did you speak today?
Quanto você falou hoje?
Cuánto hablaste hoy?
Speaking options
A lot: I spoke several times / A little: once or twice / Chat only / I only listened
Bastante: falei várias vezes / Pouco: uma ou duas vezes / Só pelo chat / Só ouvi
Bastante: hablé varias veces / Poco: una o dos veces / Solo por el chat / Solo escuché
Speaking hint
Be honest, there is no wrong answer!
Seja sincero(a), não existe resposta errada!
Sé sincero(a), no hay respuesta incorrecta!
Level
How was the level of today's conversation?
Como foi o nível da conversa de hoje?
Cómo fue el nivel de la conversación de hoy?
Level options
Too easy / A bit easy / Just right / A bit hard / Too hard
Fácil demais / Um pouco fácil / Na medida certa / Um pouco difícil / Difícil demais
Demasiado fácil / Un poco fácil / En su justa medida / Un poco difícil / Demasiado difícil
Rating
Rate today's class
Avalie a aula de hoje
Califica la clase de hoy
Rating anchors
1 Needs work · 5 Excellent
1 Precisa melhorar · 5 Excelente
1 Por mejorar · 5 Excelente
Keyword
Secret keyword
Palavra-chave secreta
Palabra clave secreta
Keyword hint
Teacher Dan says it at the end of the class.
O Teacher Dan fala no final da aula.
El Teacher Dan la dice al final de la clase.
Comment
Any comments, suggestions or questions?
Algum comentário, sugestão ou dúvida?
Algún comentario, sugerencia o duda?
Comment hint
Feel free to write in English, Portuguese or Spanish.
Pode escrever em inglês, português ou espanhol.
Puedes escribir en inglés, portugués o español.
Topic
What topic would you like to talk about in a future class?
Sobre qual tema você gostaria de conversar em uma aula futura?
Sobre qué tema te gustaría conversar en una clase futura?
Topic hint
A topic, a question, a trend, a hobby... anything!
Um tema, uma pergunta, uma tendência, um hobby... qualquer coisa!
Un tema, una pregunta, una tendencia, un pasatiempo... cualquier cosa!
Email error
Check your email
Confira seu e-mail
Revisa tu correo
Success
Thank you! Your attendance is registered. See you in the next class! 💜
Obrigado! Sua presença foi registrada. Até a próxima aula! 💜
Gracias! Tu asistencia quedó registrada. Nos vemos en la próxima clase! 💜

	•	Write the remaining UI strings (closed states, errors, install prompts, admin labels) in the same warm tone, and list them in docs/COPY_REVIEW.md for the owner to review.


9. Admin panel (/admin)
Access: Firebase Auth with Google sign-in (primary) and email-link sign-in as fallback (in case the Workspace restricts third-party Google sign-in). Allowed only when the verified email is in ADMIN_EMAILS (initially daniel.buck@rocketseat.team). Enforce this in Firestore rules AND in every admin function by verifying the ID token with the Admin SDK. Any other signed-in user sees "No access" and is signed out. Admin code is a separate lazy-loaded chunk.

Features

	•	Sessions: list, create, edit, cancel. Date/time entered in Brasília time, stored as UTC. A "Generate Tue/Thu sessions for the next N weeks" helper (default 18:00–19:00 BRT, starting 2026-10-27, skipping dates the admin deselects). Editable: topic, window offsets, requireKeyword, notes.
	•	Keyword: field per session with a "suggest" button (random friendly word from a curated list) and a warning when the keyword was already used in a previous session. Shown only to the admin.
	•	Peak audience: numeric field per session (the teacher's manual count, already excluding himself).
	•	Share screen: big QR code and URL of the permanent check-in page, ready to display on Zoom; copy-link button.
	•	Live view (projector mode): large live counter of check-ins for the open session (Firestore onSnapshot on sessionStats), country flags breakdown, auto-updating. Dark, high contrast, readable when screen-shared.
	•	Metrics (v1):
	•	Per session: check-ins, peak audience, check-ins ÷ peak, average rating, speaking distribution, level distribution, countries, roles.
	•	Overall: total sessions, total check-ins, unique students, returning students, average rating, trend by week and month, countries ranking, email-domain breakdown.
	•	Topic suggestions list (latest first, with session) and a comments feed.
	•	All metrics exclude isTeacher check-ins and use the denormalized stats.
	•	Export CSV: sessions and check-ins (one row per check-in with all fields).
	•	Data hygiene: delete a check-in (via the admin function so stats stay consistent) and a "recompute stats" repair action.


10. PWA requirements
	•	Manifest: name, short_name, description (localized if practical), start_url: "/?source=pwa", scope: "/", display: "standalone", orientation: "portrait", theme_color and background_color matching the dark theme, icons 192/512 (any + maskable), apple-touch-icon 180, shortcuts ("Check in"), screenshots (narrow + wide) for the richer install UI.
	•	Service worker (Workbox): precache the app shell; registerType: "prompt" with a toast "New version available — Refresh"; the session endpoint uses NetworkFirst with a short timeout and cache fallback (for display only); never cache POST /api/checkin (use the queue); a styled offline fallback.
	•	Install UX: capture beforeinstallprompt (Chromium) and offer an "Install app" button after a successful check-in, never before. On iOS Safari show a small instructions sheet (Share → Add to Home Screen).
	•	iOS polish: viewport-fit=cover, safe-area insets (env(safe-area-inset-*)), inputs at ≥16px font size to prevent zoom, correct status-bar meta tags, splash screens optional.
	•	No web push in v1.


11. Security and privacy
	•	Firestore: deny-by-default rules, tested. Client writes forbidden except admin on sessions and sessionSecrets.
	•	Public endpoints: validate every field with the shared Zod schemas (types, enums, lengths: comment ≤ 1000, topic ≤ 200, keyword ≤ 100). Reject unknown fields. Escape on output (React does it by default; never use dangerouslySetInnerHTML).
	•	Bot and abuse protection:
	•	Firebase App Check (reCAPTCHA Enterprise or v3) on the client; the function verifies the token with the Admin SDK. Use soft enforcement: if the token is missing or invalid, apply the strict rate-limit tier and log it, instead of blocking legitimate students. Make it switchable with APP_CHECK_ENFORCEMENT=soft|strict.
	•	Honeypot field and a minimum time-to-submit heuristic.
	•	Rate limiting: use Netlify's built-in function rate limiting if available on the current plan (confirm in the docs); in any case add a server-side limiter backed by rateLimits docs with a Firestore TTL policy. Suggested limits: max 5 wrong keyword attempts per email per session per 10 minutes; max 20 check-in requests per IP per 10 minutes. Hash IPs with a secret pepper before storing. Return 429 with retryAfter.
	•	Keyword safety: constant-time comparison, never logged, never in any response, never in the client bundle or source maps.
	•	Admin: verify Firebase ID tokens server-side on every admin function. The allowlist comes from the ADMIN_EMAILS env var.
	•	Headers (netlify.toml / _headers): strict CSP (allow only what Firebase Auth, App Check/reCAPTCHA and the Firestore SDK really need, and test it), Referrer-Policy, Permissions-Policy, X-Content-Type-Options, HSTS. CORS on functions locked to SITE_ORIGIN.
	•	Caching: hashed assets immutable; sw.js, index.html and the manifest no-cache.
	•	Privacy: collect only what the schema lists. No analytics or third-party trackers. localStorage only for convenience prefill (never sensitive). Short /privacy page in 3 languages. Dependabot enabled and pnpm audit in CI.
	•	Logs: no email addresses or keywords in logs; log IDs and error codes only.


12. Performance and accessibility budgets
Performance (mobile, throttled 4G, mid-range Android)

	•	Lighthouse mobile: Performance ≥ 95, Accessibility ≥ 95 (aim for 100), Best Practices ≥ 95, SEO ≥ 90.
	•	LCP < 2.0 s, INP < 200 ms, CLS < 0.05.
	•	Initial student JS ≤ 150 KB gzip. Code-split the admin area, charts, QR library and non-active i18n catalogs.
	•	POST /api/checkin p95 < 1 s (measure it and document the result).
	•	Enforce budgets in Lighthouse CI.

Accessibility (WCAG 2.2 AA)

	•	Semantic HTML, every input labelled, visible focus, focus moved to the new step heading when navigating, aria-live regions for status and errors, an error summary on submit.
	•	Touch targets ≥ 44×44 px. Contrast ≥ 4.5:1 in both themes. Fully keyboard operable. prefers-reduced-motion honoured. Text scalable to 200% without breaking layout.
	•	Automated axe checks in Playwright on every screen and in all 3 languages.


13. Testing and CI
	•	Unit (Vitest): email normalization/canonicalization, typo suggestions, keyword normalization and fuzzy matching, window computation and boundaries, timezone formatting, Zod schemas, CSV export.
	•	Rules (emulator): deny-by-default, admin read/write, no client writes to protected collections, unauthenticated reads denied.
	•	Functions (emulator): valid check-in, duplicate (idempotent), closed window, not-yet-open, wrong keyword (and its rate limit), fuzzy keyword, teacher email flagged, stats updated transactionally, admin delete fixes counters, non-admin token rejected, offline late grace.
	•	E2E (Playwright): mobile viewports (iPhone 14, Pixel 7) + one desktop; all 3 languages; the full check-in flow; offline flow with context.setOffline; the install manifest and service worker; axe; admin login gate (use emulator Auth).
	•	CI (GitHub Actions): install, typecheck, lint, unit, emulator tests, build, Playwright, Lighthouse CI, pnpm audit. Netlify deploy previews on pull requests.
	•	Definition of done for each milestone: CI green, docs updated, owner-actions list printed.


14. Deployment and setup
	•	Repo: GitHub (owner's account). Hosting: Netlify connected to the repo. Database: Firebase project (Firestore in southamerica-east1, production mode).
	•	netlify.toml: build command, publish dir, functions dir, SPA fallback that does NOT shadow /api/* or /.netlify/functions/*, security and cache headers.
	•	Local dev: Firebase emulators (Firestore + Auth) plus netlify dev. Provide pnpm dev, pnpm test, pnpm test:e2e, pnpm emulators, pnpm lint, pnpm build and a seed script for local data.
	•	Environment variables

Variable
Where
Secret
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_APPCHECK_SITE_KEY
client build
no (public web config)
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
functions
yes
ADMIN_EMAILS (initially daniel.buck@rocketseat.team)
functions
no
SITE_ORIGIN, APP_CHECK_ENFORCEMENT
functions
no
HASH_PEPPER
functions
yes

Store the three service-account fields separately instead of the whole JSON: Netlify limits the total size of environment variables available to functions (historically 4 KB; confirm in the docs). Handle \n in the private key.

	•	docs/SETUP.md must cover, step by step: creating the Firebase project and enabling Firestore; enabling Auth (Google provider + email link) and authorized domains (localhost, the Netlify domain, any custom domain); registering App Check with reCAPTCHA and local debug tokens; creating the service account and copying the three fields into Netlify; deploying firestore.rules, firestore.indexes.json and the TTL policy with the Firebase CLI; importing the repo into Netlify and setting env vars; checking that the Netlify site name is available (and how to set a custom domain later); enabling deploy previews; creating the first sessions from the admin panel; rotating the service-account key; a troubleshooting section.


15. Suggested repository structure
/
├─ src/
│  ├─ app/ routes/ providers
│  ├─ features/checkin/ (steps, components, offline-queue, hooks)
│  ├─ features/admin/ (sessions, live, metrics, share)
│  ├─ components/ (ui primitives)
│  ├─ i18n/ (en.json, pt.json, es.json)
│  ├─ lib/ (firebase, api client, time, pwa)
│  └─ config/app.ts
├─ shared/            zod schemas, types, constants, email + keyword + window logic (used by client AND functions)
├─ netlify/functions/ sessions-current.ts, checkin.ts, admin-delete-checkin.ts, admin-recompute-stats.ts
├─ firebase/          firestore.rules, firestore.indexes.json, firebase.json, rules tests
├─ e2e/               Playwright tests
├─ docs/              PLAN.md, SETUP.md, ARCHITECTURE.md, DATA_MODEL.md, COPY_REVIEW.md, adr/
├─ public/            icons, robots.txt
├─ .github/workflows/ci.yml
└─ netlify.toml, vite.config.ts, tailwind config, tsconfig, eslint config, .nvmrc


16. Milestones and acceptance criteria
#
Milestone
Done when
M0
Scaffold, CI, Netlify deploy
Hello-world PWA deployed with a preview URL, CI green, Lighthouse CI running
M1
Data model, rules, functions
Rules and function tests pass on the emulator; GET /api/sessions/current and POST /api/checkin work end to end
M2
Student check-in
The full flow works in 3 languages with typo suggestions, keyword validation, duplicate handling and all states
M3
Offline + PWA polish
Installable, offline queue works, update toast works, iOS polish done
M4
Admin panel
Google login gate, session generator, keyword, peak audience, share/QR, live view, metrics, CSV, delete
M5
Hardening and docs
Budgets met, a11y clean, rate limits and App Check verified, docs complete, final self-review


17. Edge-case checklist (verify all)
	•	Window boundaries to the second; open on Tuesday and Thursday; closed on the days between.
	•	Same email twice (also with Gmail dots/+tag variations) → one check-in, friendly message.
	•	Wrong keyword ×6 → rate-limit message; the correct keyword with a typo of 1 character → accepted as fuzzy; trade off / TRADE-OFF / tradeoff all match.
	•	Offline submit → queued → delivered after reconnect; delivered after the window closed → accepted as late only within the grace rule.
	•	Device clock wrong by hours → countdowns still correct (server time).
	•	Typo domains blocked; unusual domains allowed; DNS timeout does not block.
	•	Teacher email typed in the check-in → counted as isTeacher, no admin access, excluded from metrics.
	•	Non-admin Google account on /admin → "No access" and signed out; admin functions reject missing or non-admin tokens.
	•	No sessions yet; cancelled session; two overlapping sessions (chooser).
	•	Language auto-detection, manual switch persisted, ?lang= override, Spanish copy without opening ¡ ¿.
	•	Light/dark themes, 200% text zoom, screen reader pass on the rating control and the country combobox.
	•	Service worker update path; installed PWA opens on /?source=pwa.
	•	Secret keyword absent from every client bundle, response, log and source map.


18. Do NOT
	•	No student accounts or logins. No Next.js. No Cloud Functions or anything that needs the Blaze plan.
	•	No analytics or tracking SDKs. No secrets in the repo.
	•	No legacy data import. No gamification or push notifications yet (data model is ready for them).
	•	No per-class links or class dropdown for students.
	•	No UI libraries beyond Tailwind plus headless a11y primitives.


19. Final deliverables
	•	Deployed app on Netlify (production + deploy previews) with the Firebase project wired up.
	•	All code, tests and CI in the GitHub repo, with Conventional Commit history.
	•	README.md, docs/SETUP.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md, docs/COPY_REVIEW.md, ADRs.
	•	A final report: what was built per milestone, Lighthouse and test results, known limitations, and a list of the owner's remaining manual steps.
```
