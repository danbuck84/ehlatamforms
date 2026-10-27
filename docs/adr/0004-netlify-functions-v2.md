# ADR 0004: Netlify Functions v2 + `@netlify/vite-plugin`

- **Context:** Netlify's current serverless functions API uses Web-standard `Request` and `Response` default exports with an in-file `export const config: Config = { path, rateLimit }`.
- **Decision:** Author all four endpoints (`sessions-current.ts`, `checkin.ts`, `admin-delete-checkin.ts`, `admin-recompute-stats.ts`) using Web-standard `Request`/`Response` and custom `path: "/api/..."` routing, and emulate them locally inside `pnpm dev` via `@netlify/vite-plugin`.
- **Consequences:** No URL rewrite shadowing between `/api/*` and the SPA fallback, native platform rate-limiting on `/api/checkin` alongside the Firestore `rateLimits` collection, and single-command local development (`pnpm dev`).
