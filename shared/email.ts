import { damerauLevenshtein } from './text';

/** Common providers we compare typed domains against. */
export const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'live.com',
  'msn.com',
  'proton.me',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'hotmail.es',
  'outlook.es',
  'yahoo.es',
  'googlemail.com',
] as const;

/** Known-bad domains seen in the legacy form, mapped to the intended one. Submit is blocked. */
export const KNOWN_TYPO_DOMAINS: Readonly<Record<string, string>> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hmail.com': 'gmail.com',
  'hotrmail.com': 'hotmail.com',
  'hormail.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.om': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'icloud.co': 'icloud.com',
};

/** TLD typos that are never valid for the common providers. */
const TLD_TYPOS: Readonly<Record<string, string>> = {
  con: 'com',
  cm: 'com',
  om: 'com',
  cmo: 'com',
  comm: 'com',
  vom: 'com',
  xom: 'com',
  'com.bt': 'com.br',
  'con.br': 'com.br',
  'cm.br': 'com.br',
};

const PROVIDER_SLDS = new Set(COMMON_DOMAINS.map((d) => d.split('.')[0]!));
const COMMON_SET: ReadonlySet<string> = new Set(COMMON_DOMAINS);

/** Basic, permissive email shape check (the server also checks MX records). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function splitEmail(email: string): { local: string; domain: string } {
  const at = email.lastIndexOf('@');
  if (at < 0) return { local: email, domain: '' };
  return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

export function emailDomain(email: string): string {
  return splitEmail(normalizeEmail(email)).domain;
}

/**
 * Canonical form used for deduplication:
 * - gmail.com / googlemail.com: remove dots and +tag in the local part, domain → gmail.com
 * - other domains: strip +tag only
 */
export function canonicalEmail(raw: string): string {
  const email = normalizeEmail(raw);
  const { local, domain } = splitEmail(email);
  const untagged = local.split('+')[0] ?? local;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${untagged.replace(/\./g, '')}@gmail.com`;
  }
  return `${untagged}@${domain}`;
}

function splitDomain(domain: string): { sld: string; tld: string } {
  const parts = domain.split('.');
  // Treat "com.br" style two-part TLDs as one TLD.
  if (parts.length >= 3 && parts[parts.length - 1]!.length === 2 && parts[parts.length - 2]!.length <= 3) {
    return { sld: parts.slice(0, -2).join('.'), tld: parts.slice(-2).join('.') };
  }
  return { sld: parts.slice(0, -1).join('.'), tld: parts[parts.length - 1] ?? '' };
}

/** Returns the intended domain for a likely typo, or null when the domain looks fine. */
export function suggestDomain(domainRaw: string): string | null {
  const domain = domainRaw.trim().toLowerCase();
  if (!domain || COMMON_SET.has(domain)) return null;
  const known = KNOWN_TYPO_DOMAINS[domain];
  if (known) return known;

  const { sld, tld } = splitDomain(domain);
  const fixedTld = TLD_TYPOS[tld];
  if (fixedTld) {
    const candidate = `${sld}.${fixedTld}`;
    if (COMMON_SET.has(candidate)) return candidate;
    if (tld === 'con' || tld === 'con.br') return candidate;
  }

  let best: string | null = null;
  let bestDist = Infinity;
  for (const common of COMMON_DOMAINS) {
    // Allow 1 edit for short domains, 2 for longer ones.
    const limit = common.length >= 10 ? 2 : 1;
    const d = damerauLevenshtein(domain, common, limit);
    if (d <= limit && d < bestDist) {
      best = common;
      bestDist = d;
    }
  }
  if (best === 'googlemail.com') return null;
  return best;
}

/** Full-address suggestion, e.g. "maria@gmial.com" → "maria@gmail.com". */
export function suggestEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  const { local, domain } = splitEmail(email);
  if (!local || !domain) return null;
  const suggestion = suggestDomain(domain);
  return suggestion ? `${local}@${suggestion}` : null;
}

/** Domains we refuse until corrected (known typos and provider + bad TLD). */
export function isBlockedDomain(domainRaw: string): boolean {
  const domain = domainRaw.trim().toLowerCase();
  if (KNOWN_TYPO_DOMAINS[domain]) return true;
  const { sld, tld } = splitDomain(domain);
  if (tld === 'con' || tld === 'con.br') return true;
  if (TLD_TYPOS[tld] && PROVIDER_SLDS.has(sld)) return true;
  return false;
}

export function isValidEmailShape(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}
