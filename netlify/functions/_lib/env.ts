import { normalizeEmail } from '../../../shared/email';

/** Reads an env var (Netlify exposes them on process.env inside Functions). */
export function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? undefined : v;
}

export function adminEmails(): string[] {
  return (env('ADMIN_EMAILS') ?? '')
    .split(',')
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export type AppCheckEnforcement = 'soft' | 'strict' | 'off';
export function appCheckEnforcement(): AppCheckEnforcement {
  const v = env('APP_CHECK_ENFORCEMENT');
  if (v === 'strict' || v === 'off') return v;
  return 'soft';
}

export function hashPepper(): string {
  // A missing pepper in production is a configuration error; in local dev/emulator
  // a fixed value keeps things working.
  return env('HASH_PEPPER') ?? 'dev-only-pepper';
}

export function siteOrigin(): string | undefined {
  return env('SITE_ORIGIN');
}
