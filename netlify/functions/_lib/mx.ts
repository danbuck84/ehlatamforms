import { promises as dns } from 'node:dns';
import { COMMON_DOMAINS } from '../../../shared/email';

export type MxResult = 'ok' | 'invalid' | 'unknown';

const cache = new Map<string, { result: MxResult; at: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000;
const COMMON: ReadonlySet<string> = new Set(COMMON_DOMAINS);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function code(e: unknown): string | undefined {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/**
 * Checks that the domain can receive email. Only a *definitive* answer rejects:
 * NXDOMAIN, or no MX and no A/AAAA (implicit MX). Timeouts and other errors → 'unknown' (allowed).
 */
export async function checkMx(domain: string, timeoutMs = 1500): Promise<MxResult> {
  if (COMMON.has(domain)) return 'ok';
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  let result: MxResult;
  try {
    const mx = await withTimeout(dns.resolveMx(domain), timeoutMs);
    result = mx.length > 0 ? 'ok' : 'invalid';
  } catch (e) {
    const c = code(e);
    if (c === 'ENOTFOUND') result = 'invalid';
    else if (c === 'ENODATA') {
      try {
        const a = await withTimeout(dns.resolve(domain), timeoutMs);
        result = a.length > 0 ? 'ok' : 'invalid';
      } catch (e2) {
        const c2 = code(e2);
        result = c2 === 'ENOTFOUND' || c2 === 'ENODATA' ? 'invalid' : 'unknown';
      }
    } else result = 'unknown';
  }
  if (result !== 'unknown') cache.set(domain, { result, at: Date.now() });
  return result;
}
