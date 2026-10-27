import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CheckinError, CheckinRequest, CheckinSuccess } from '../../../shared/schemas';

/**
 * Offline queue for check-ins (IndexedDB). Shared by the page and the service worker.
 * - `pending`: payloads waiting to be delivered.
 * - `results`: outcome of delivered items, read once by the page to inform the student.
 */
interface QueueDB extends DBSchema {
  pending: { key: string; value: { id: string; payload: CheckinRequest; queuedAt: number; attempts: number } };
  results: {
    key: string;
    value: { id: string; ok: boolean; body: CheckinSuccess | CheckinError; at: number };
  };
}

const DB_NAME = 'englishtalk-queue';
let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function db(): Promise<IDBPDatabase<QueueDB>> {
  dbPromise ??= openDB<QueueDB>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('pending', { keyPath: 'id' });
      database.createObjectStore('results', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function enqueue(payload: CheckinRequest): Promise<void> {
  const d = await db();
  await d.put('pending', { id: payload.clientSubmissionId, payload, queuedAt: Date.now(), attempts: 0 });
}

export async function pendingCount(): Promise<number> {
  return (await db()).count('pending');
}

export async function takeResults(): Promise<QueueDB['results']['value'][]> {
  const d = await db();
  const all = await d.getAll('results');
  const tx = d.transaction('results', 'readwrite');
  await Promise.all([...all.map((r) => tx.store.delete(r.id)), tx.done]);
  return all;
}

/** Retry later on network errors, 429 and 5xx; everything else is a final answer. */
function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

let flushing: Promise<{ sent: number; failed: number }> | null = null;

/**
 * Sends every pending item. Safe to call concurrently (calls are coalesced).
 * `getHeaders` lets the page attach an App Check token; the service worker sends none
 * (the server then applies the strict rate-limit tier in soft mode).
 */
export function flushQueue(
  fetchImpl: typeof fetch,
  getHeaders: () => Promise<Record<string, string>> = async () => ({}),
): Promise<{ sent: number; failed: number }> {
  flushing ??= (async () => {
    let sent = 0;
    let failed = 0;
    try {
      const d = await db();
      const items = await d.getAll('pending');
      for (const item of items) {
        let res: Response;
        try {
          res = await fetchImpl('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getHeaders()) },
            body: JSON.stringify(item.payload),
          });
        } catch {
          break; // still offline: stop and keep everything queued
        }
        if (isRetryable(res.status)) {
          await d.put('pending', { ...item, attempts: item.attempts + 1 });
          continue;
        }
        const body = (await res.json().catch(() => ({ error: 'server' }))) as CheckinSuccess | CheckinError;
        await d.put('results', { id: item.id, ok: res.ok, body, at: Date.now() });
        await d.delete('pending', item.id);
        if (res.ok) sent++;
        else failed++;
      }
    } finally {
      flushing = null;
    }
    return { sent, failed };
  })();
  return flushing;
}
