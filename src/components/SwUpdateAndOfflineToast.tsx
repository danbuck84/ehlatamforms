import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { flushQueue, pendingCount, takeResults } from '../features/checkin/offline-queue';
import { buildCheckinHeaders } from '../lib/api';

export function SwUpdateAndOfflineToast() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [queued, setQueued] = useState(0);
  const [flushedToast, setFlushedToast] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    let mounted = true;
    const syncQueue = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await flushQueue(fetch.bind(window), buildCheckinHeaders);
        if (mounted && res.sent > 0) setFlushedToast(true);
      }
      const results = await takeResults();
      if (mounted && results.some((r) => r.ok)) {
        setFlushedToast(true);
      }
      const count = await pendingCount();
      if (mounted) setQueued(count);
    };

    const onOnline = () => {
      setIsOffline(false);
      void syncQueue();
    };
    const onOffline = () => {
      setIsOffline(true);
      void pendingCount().then((c) => mounted && setQueued(c));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncQueue();
    };
    const onQueueChanged = () => {
      void pendingCount().then((c) => mounted && setQueued(c));
    };
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; sent?: number } | undefined;
      if (data?.type === 'QUEUE_FLUSHED') {
        if ((data.sent ?? 0) > 0) setFlushedToast(true);
        void syncQueue();
      }
    };

    void syncQueue();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('englishtalk:queue-updated', onQueueChanged);
    document.addEventListener('visibilitychange', onVisibility);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('englishtalk:queue-updated', onQueueChanged);
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, []);

  return (
    <>
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-xs text-[var(--text-secondary)]"
        >
          📡 {t('app.offlineBanner')}
        </div>
      )}
      {!isOffline && queued > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-xs text-[var(--text-secondary)]"
        >
          ⏳ {t('app.queuedBanner', { count: queued })}
        </div>
      )}
      {flushedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] shadow-xl"
        >
          <span>{t('app.queuedFlushedToast')}</span>
          <button
            type="button"
            onClick={() => setFlushedToast(false)}
            className="min-h-11 min-w-11 rounded-xl px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            {t('app.dismiss')}
          </button>
        </div>
      )}
      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-[var(--primary)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-xl"
        >
          <span>{t('app.swUpdateTitle')}</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="min-h-11 rounded-xl bg-[var(--primary)] px-3 py-1.5 font-semibold text-white"
          >
            {t('app.swUpdateAction')}
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="min-h-11 rounded-xl px-2 text-xs text-[var(--text-secondary)]"
          >
            {t('app.dismiss')}
          </button>
        </div>
      )}
    </>
  );
}
