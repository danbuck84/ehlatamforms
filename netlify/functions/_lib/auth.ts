import { appCheck, adminAuth } from './firebase';
import { adminEmails, appCheckEnforcement, env } from './env';
import { normalizeEmail } from '../../../shared/email';

export type AppCheckStatus = 'valid' | 'missing' | 'invalid' | 'skipped';

/** Verifies the X-Firebase-AppCheck header with the Admin SDK. */
export async function verifyAppCheck(req: Request): Promise<AppCheckStatus> {
  if (appCheckEnforcement() === 'off') return 'skipped';
  const token = req.headers.get('x-firebase-appcheck');
  if (!token) return 'missing';
  // The Auth/Firestore emulators cannot verify real App Check tokens.
  if (env('FIRESTORE_EMULATOR_HOST')) return token === 'test-valid' ? 'valid' : 'invalid';
  try {
    await appCheck().verifyToken(token);
    return 'valid';
  } catch {
    return 'invalid';
  }
}

export type AdminCheck = { ok: true; email: string; uid: string } | { ok: false; status: 401 | 403 };

/** Verifies a Firebase ID token and the admin allowlist (email must be verified). */
export async function verifyAdmin(req: Request): Promise<AdminCheck> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match?.[1]) return { ok: false, status: 401 };
  try {
    const decoded = await adminAuth().verifyIdToken(match[1], true);
    const email = decoded.email ? normalizeEmail(decoded.email) : '';
    if (!email || decoded.email_verified !== true || !adminEmails().includes(email)) {
      return { ok: false, status: 403 };
    }
    return { ok: true, email, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401 };
  }
}
