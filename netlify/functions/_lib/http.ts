import { env } from './env';

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

/** SITE_ORIGIN plus the URLs Netlify assigns to this very deploy (previews), plus localhost outside production. */
function allowedOrigins(): Set<string> {
  const list = [env('SITE_ORIGIN'), env('URL'), env('DEPLOY_PRIME_URL'), env('DEPLOY_URL')].filter(
    (v): v is string => Boolean(v),
  );
  return new Set(list.map((u) => u.replace(/\/$/, '')));
}

function isLocalOrigin(origin: string): boolean {
  return env('CONTEXT') !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().has(origin) || isLocalOrigin(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !isAllowedOrigin(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(req: Request, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...corsHeaders(req), ...extra },
  });
}

/**
 * Handles CORS preflight and rejects cross-origin browser requests from unknown sites.
 * Requests without an Origin header (same-origin GET, server-to-server) pass through.
 */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  const origin = req.headers.get('origin');
  const configured = allowedOrigins().size > 0;
  if (configured && origin && !isAllowedOrigin(origin)) {
    return json(req, 403, { error: 'forbidden_origin' });
  }
  return null;
}

const MAX_BODY_BYTES = 8 * 1024;

/** Reads a JSON body with a hard size limit. Returns undefined when invalid. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Logs only IDs and codes — never emails or keywords. */
export function logEvent(event: string, data: Record<string, string | number | boolean | null> = {}): void {
  console.log(JSON.stringify({ event, ...data }));
}
