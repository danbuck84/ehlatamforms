import type { Config, Context } from '@netlify/functions';
import { adminDeleteSchema } from '../../shared/schemas';
import { db } from './_lib/firebase';
import { verifyAdmin } from './_lib/auth';
import { json, logEvent, preflight, readJson } from './_lib/http';
import { deleteCheckin } from './_lib/admin-service';

export default async (req: Request, _context: Context): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const admin = await verifyAdmin(req);
  if (!admin.ok) return json(req, admin.status, { error: 'unauthorized' });

  const raw = await readJson(req);
  const parsed = adminDeleteSchema.safeParse(raw);
  if (!parsed.success) return json(req, 400, { error: 'validation' });

  try {
    const status = await deleteCheckin(db(), parsed.data.checkinId);
    logEvent('admin_delete_checkin', { status, session: parsed.data.checkinId.split('__')[0] ?? '' });
    return json(req, 200, { status });
  } catch (err) {
    logEvent('admin_delete_error', { code: err instanceof Error ? err.name : 'unknown' });
    return json(req, 500, { error: 'server' });
  }
};

export const config: Config = {
  path: '/api/admin/delete-checkin',
};
