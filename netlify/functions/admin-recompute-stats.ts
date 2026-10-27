import type { Config, Context } from '@netlify/functions';
import { adminRecomputeSchema } from '../../shared/schemas';
import { db } from './_lib/firebase';
import { verifyAdmin } from './_lib/auth';
import { json, logEvent, preflight, readJson } from './_lib/http';
import { recomputeStats } from './_lib/admin-service';

export default async (req: Request, _context: Context): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const admin = await verifyAdmin(req);
  if (!admin.ok) return json(req, admin.status, { error: 'unauthorized' });

  const raw = await readJson(req);
  const parsed = adminRecomputeSchema.safeParse(raw ?? {});
  if (!parsed.success) return json(req, 400, { error: 'validation' });

  try {
    const result = await recomputeStats(db(), parsed.data.sessionId);
    logEvent('admin_recompute_stats', { sessions: result.sessions, checkins: result.checkins });
    return json(req, 200, result);
  } catch (err) {
    logEvent('admin_recompute_error', { code: err instanceof Error ? err.name : 'unknown' });
    return json(req, 500, { error: 'server' });
  }
};

export const config: Config = {
  path: '/api/admin/recompute-stats',
};
