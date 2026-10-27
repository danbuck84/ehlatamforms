import { WINDOW_DEFAULTS } from './constants';

export type SessionStatus = 'scheduled' | 'cancelled';

/** Session data as needed by the window logic (instants in epoch ms). */
export interface WindowInput {
  startsAtMs: number;
  opensOffsetMin?: number | null;
  closesOffsetMin?: number | null;
  status: SessionStatus;
}

export interface CheckinWindow {
  opensAtMs: number;
  closesAtMs: number;
}

const MINUTE = 60_000;

export function computeWindow(s: WindowInput): CheckinWindow {
  const opens = s.opensOffsetMin ?? WINDOW_DEFAULTS.opensOffsetMin;
  const closes = s.closesOffsetMin ?? WINDOW_DEFAULTS.closesOffsetMin;
  return {
    opensAtMs: s.startsAtMs - opens * MINUTE,
    closesAtMs: s.startsAtMs + closes * MINUTE,
  };
}

/** Open when opensAt <= now < closesAt (inclusive start, exclusive end). Cancelled never opens. */
export function isOpenAt(s: WindowInput, nowMs: number): boolean {
  if (s.status !== 'scheduled') return false;
  const w = computeWindow(s);
  return w.opensAtMs <= nowMs && nowMs < w.closesAtMs;
}

export type WindowState = 'open' | 'not_yet_open' | 'closed' | 'cancelled';

export function windowState(s: WindowInput, nowMs: number): WindowState {
  if (s.status === 'cancelled') return 'cancelled';
  const w = computeWindow(s);
  if (nowMs < w.opensAtMs) return 'not_yet_open';
  if (nowMs >= w.closesAtMs) return 'closed';
  return 'open';
}

/**
 * Splits sessions into the ones open now (sorted by start) and the next one to open.
 */
export function selectCurrent<T extends WindowInput>(
  sessions: readonly T[],
  nowMs: number,
): { open: T[]; next: T | null } {
  const scheduled = sessions.filter((s) => s.status === 'scheduled');
  const open = scheduled.filter((s) => isOpenAt(s, nowMs)).sort((a, b) => a.startsAtMs - b.startsAtMs);
  const upcoming = scheduled
    .filter((s) => computeWindow(s).opensAtMs > nowMs)
    .sort((a, b) => computeWindow(a).opensAtMs - computeWindow(b).opensAtMs);
  return { open, next: upcoming[0] ?? null };
}

export type AcceptanceResult =
  | { ok: true; late: boolean }
  | { ok: false; reason: 'not_yet_open' | 'closed' | 'cancelled' };

/** Max tolerated difference between the device clock and the server (future captures). */
const CLIENT_SKEW_MS = 10 * MINUTE;

/**
 * Decides whether a check-in can be accepted now.
 * - Inside the window → accepted, not late.
 * - Offline grace: if the client captured it inside the window and it reaches the server
 *   within `graceMs` after closesAt → accepted with late = true (trust-based).
 */
export function acceptCheckin(
  s: WindowInput,
  nowMs: number,
  clientCapturedAtMs: number | null | undefined,
  graceMs: number = WINDOW_DEFAULTS.graceMs,
): AcceptanceResult {
  const state = windowState(s, nowMs);
  if (state === 'cancelled') return { ok: false, reason: 'cancelled' };
  if (state === 'open') return { ok: true, late: false };
  if (state === 'not_yet_open') return { ok: false, reason: 'not_yet_open' };

  const w = computeWindow(s);
  if (
    clientCapturedAtMs != null &&
    Number.isFinite(clientCapturedAtMs) &&
    clientCapturedAtMs >= w.opensAtMs &&
    clientCapturedAtMs < w.closesAtMs &&
    clientCapturedAtMs <= nowMs + CLIENT_SKEW_MS &&
    nowMs < w.closesAtMs + graceMs
  ) {
    return { ok: true, late: true };
  }
  return { ok: false, reason: 'closed' };
}
