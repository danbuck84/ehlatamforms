import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@netlify/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_CONFIG } from './src/config/app.ts';
import pkg from './package.json' with { type: 'json' };

const isTest = process.env.VITEST === 'true';

/**
 * Dev server only (`pnpm dev`); builds, `pnpm preview`, the E2E tests and production are unaffected
 * (production headers come from netlify.toml on Netlify).
 * 1. Load the local .env (e.g. FIRESTORE_EMULATOR_HOST) into process.env so the Netlify Functions
 *    emulated by the Netlify plugin talk to the Firebase emulators. Must run before that plugin starts.
 * 2. Drop the production Content-Security-Policy that the Netlify plugin copies from netlify.toml:
 *    it blocks the inline script React Fast Refresh injects, which left the dev page blank.
 */
const localDevServer: Plugin = {
  name: 'englishtalk:local-dev-server',
  apply: 'serve',
  configureServer(server) {
    const fileEnv = loadEnv(server.config.mode, server.config.envDir || server.config.root, '');
    for (const [key, value] of Object.entries(fileEnv)) {
      process.env[key] ??= value;
    }
    server.middlewares.use((_req, res, next) => {
      const setHeader = res.setHeader.bind(res);
      res.setHeader = ((name: string, value: number | string | readonly string[]) =>
        name.toLowerCase() === 'content-security-policy'
          ? res
          : setHeader(name, value)) as typeof res.setHeader;
      next();
    });
  },
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    // Source maps are generated for debugging but never contain secrets
    // (the keyword never reaches the client). They are not uploaded publicly
    // by default: see netlify.toml (hidden source maps).
    sourcemap: 'hidden',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Admin-only SDKs get stable chunk names so the service worker can skip precaching them.
            {
              name: 'admin-firebase',
              test: /node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?@?firebase/,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(recharts|d3-|victory-vendor|@reduxjs|immer|reselect|redux|es-toolkit|decimal\.js)/,
            },
            {
              name: 'qr',
              test: /node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(qrcode|pngjs|dijkstrajs)/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    localDevServer,
    // Emulates Netlify Functions, redirects and headers inside `pnpm dev`.
    // Edge Functions are not used by this project; their local Deno server crashed `pnpm dev`.
    !isTest && netlify({ edgeFunctions: { enabled: false } }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Admin-only chunks are fetched on demand instead of being precached.
        globIgnores: [
          '**/admin*.js',
          '**/AdminPage*.js',
          '**/ShareScreen*.js',
          '**/TrendChart*.js',
          '**/charts*.js',
          '**/qr*.js',
          'screenshots/**',
        ],
      },
      devOptions: { enabled: false, type: 'module' },
      manifest: {
        id: '/',
        name: APP_CONFIG.APP_NAME,
        short_name: APP_CONFIG.SHORT_NAME,
        description: `${APP_CONFIG.TAGLINE} · ${APP_CONFIG.CO_BRAND}`,
        lang: 'en',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: APP_CONFIG.THEME.background,
        background_color: APP_CONFIG.THEME.background,
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Check in',
            short_name: 'Check in',
            url: '/?source=pwa-shortcut',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        screenshots: [
          {
            src: '/screenshots/narrow.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Check in to class in three quick steps',
          },
          {
            src: '/screenshots/wide.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Check in to class in three quick steps',
          },
        ],
      },
    }),
  ],
});
