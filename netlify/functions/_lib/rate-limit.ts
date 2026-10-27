import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { hmacHex } from './crypto';
import { hashPepper } from './env';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter stored in `rateLimits/{hmac(key)}`.
 * `expiresAt` is covered by a Firestore TTL policy so old docs are cleaned up automatically.
 * Keys are HMAC'd with the pepper: no raw IPs or emails are stored.
 */
export async function hitRateLimit(
  firestore: Firestore,
  key: string,
  limit: { max: number; windowSec: number },
  nowMs: number,
  opts: { peek?: boolean } = {},
): Promise<RateLimitResult> {
  const ref = firestore.collection('rateLimits').doc(hmacHex(key, hashPepper()));
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count: number; windowStartMs: number } | undefined;
    const windowMs = limit.windowSec * 1000;
    const fresh = !data || nowMs - data.windowStartMs >= windowMs;
    const windowStartMs = fresh ? nowMs : data.windowStartMs;
    const current = fresh ? 0 : data.count;
    const retryAfterSec = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));
    if (current >= limit.max) return { allowed: false, count: current, retryAfterSec };
    if (opts.peek) return { allowed: true, count: current, retryAfterSec };
    tx.set(ref, {
      count: current + 1,
      windowStartMs,
      expiresAt: Timestamp.fromMillis(windowStartMs + windowMs + 60_000),
    });
    return { allowed: true, count: current + 1, retryAfterSec };
  });
}
