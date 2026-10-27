import type { Config, Context } from '@netlify/functions';
import { db } from './_lib/firebase';
import { json, logEvent, preflight } from './_lib/http';
import { currentSessions, toPublicSession } from './_lib/sessions';
import type { SessionsCurrentResponse } from '../../shared/schemas';

export default async (req: Request, _context: Context): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'GET') return json(req, 405, { error: 'method_not_allowed' });

  const nowMs = Date.now();
  try {
    const { open, next } = await currentSessions(db(), nowMs);
    const body: SessionsCurrentResponse = {
      serverNow: new Date(nowMs).toISOString(),
      open: open.map(toPublicSession),
      next: next ? toPublicSession(next) : null,
    };
    return json(req, 200, body);
  } catch (err) {
    logEvent('sessions_current_error', { code: err instanceof Error ? err.name : 'unknown' });
    return json(req, 500, { error: 'server' });
  }
};

export const config: Config = {
  path: '/api/sessions/current',
};
