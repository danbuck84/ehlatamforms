# ADR 0001: Pin Latest Stable Package Versions (Oct 2026)

- **Context:** The build brief requires checking the npm registry at the start and pinning the latest stable versions.
- **Decision:** We queried `npm view <pkg> version` and pinned React 19.3.1, Vite 8.3.5 (Rolldown bundler), Tailwind CSS 4.3.3 (`@tailwindcss/vite`), React Router 8.5.0, Zod 4.6.7 (`zod/mini` in shared schemas), Firebase 13.1.0, Firebase Admin 14.5.0, `@netlify/functions` 6.0.3, `@netlify/vite-plugin` 3.0.1, Vitest 5.0.5, Playwright 1.64.1, and TypeScript 6.0.3 (the highest version supported by `typescript-eslint@8.72.1`'s peer range `<6.1.0`).
- **Consequences:** Deterministic installs, full support for modern Web-standard `Request`/`Response` Netlify Functions, and a 120.7 KB gzip student entry bundle (well under the 150 KB budget).
