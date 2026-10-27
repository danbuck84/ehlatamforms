import type { Config, Context } from '@netlify/functions';
import { db } from './_lib/firebase';
import { adminEmails, appCheckEnforcement } from './_lib/env';
import { json, logEvent, preflight, readJson } from './_lib/http';
import { verifyAppCheck } from './_lib/auth';
import { checkMx } from './_lib/mx';
import { processCheckin } from './_lib/checkin-service';

export default async (req: Request, context: Context): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const body = await readJson(req);
  if (body === undefined) return json(req, 400, { error: 'validation' });

  const clientIp =
    context?.ip ||
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  try {
    const appCheckStatus = await verifyAppCheck(req);
    const result = await processCheckin(body, {
      db: db(),
      nowMs: () => Date.now(),
      appCheckStatus,
      appCheckEnforcement: appCheckEnforcement(),
      checkMx,
      clientIp,
      adminEmails: adminEmails(),
      log: logEvent,
    });
    return json(req, result.status, result.body, result.headers);
  } catch (err) {
    logEvent('checkin_error', { code: err instanceof Error ? err.name : 'unknown' });
    return json(req, 500, { error: 'server' });
  }
};

export const config: Config = {
  path: '/api/checkin',
  rateLimit: {
    windowLimit: 20,
    windowSize: 180,
    aggregateBy: ['ip', 'domain'],
  },
};
