import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@netlify/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_CONFIG } from './src/config/app.ts';
import pkg from './package.json' with { type: 'json' };

const isTest = process.env.VITEST === 'true';

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
            { name: 'qr', test: /node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(qrcode|pngjs|dijkstrajs)/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Emulates Netlify Functions, redirects and headers inside `pnpm dev`.
    !isTest && netlify(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
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
