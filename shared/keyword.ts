import { damerauLevenshtein, foldText } from './text';
import type { KeywordMatch } from './constants';

/**
 * Compact form used for comparison: lowercase, no diacritics, and only letters/digits
 * (spaces, hyphens, underscores and punctuation removed).
 * "TRADE-OFF", "trade off" and "tradeoff" all become "tradeoff".
 */
export function compactKeyword(value: string): string {
  return foldText(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

export const FUZZY_MIN_LENGTH = 5;

/**
 * Compares a typed keyword with the session secret.
 * `equals` is injected so the server can use a constant-time comparison.
 */
export function matchKeyword(
  typed: string,
  secret: string,
  fuzzy: boolean,
  equals: (a: string, b: string) => boolean = (a, b) => a === b,
): Exclude<KeywordMatch, 'not_required'> | null {
  const a = compactKeyword(typed);
  const b = compactKeyword(secret);
  if (!a || !b) return null;
  if (equals(a, b)) return 'exact';
  if (fuzzy && b.length >= FUZZY_MIN_LENGTH && damerauLevenshtein(a, b, 1) <= 1) return 'fuzzy';
  return null;
}
