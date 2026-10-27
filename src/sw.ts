/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { flushQueue } from './features/checkin/offline-queue';

declare const self: ServiceWorkerGlobalScope;

// Precache the app shell (injected at build time).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigations → precached index.html, except API and Netlify internals.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/\.netlify\//],
  }),
);

// Session info: network first with a short timeout, cached copy for display only.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/sessions/current',
  new NetworkFirst({
    cacheName: 'api-sessions',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 7 * 24 * 3600 }),
    ],
  }),
);
// POST /api/checkin is never cached: offline submissions go through the IndexedDB queue.

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
  if (data?.type === 'FLUSH_QUEUE') event.waitUntil(flushQueue(fetch.bind(self)).then(notifyClients));
});

// Background Sync (Chromium): deliver queued check-ins even if the page is closed.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'checkin-queue') {
    event.waitUntil(flushQueue(fetch.bind(self)).then(notifyClients));
  }
}) as EventListener);

async function notifyClients(result: { sent: number; failed: number }): Promise<void> {
  if (result.sent === 0 && result.failed === 0) return;
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'QUEUE_FLUSHED', ...result });
}
