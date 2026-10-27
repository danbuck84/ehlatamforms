/**
 * Optimal string alignment distance (restricted Damerau–Levenshtein):
 * insertions, deletions, substitutions and transpositions of adjacent chars
 * each cost 1. `max` allows an early exit once the distance exceeds it.
 */
export function damerauLevenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Three rolling rows: i-2, i-1, i
  let prevPrev = new Array<number>(lb + 1).fill(0);
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  let curr = new Array<number>(lb + 1).fill(0);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        v = Math.min(v, prevPrev[j - 2]! + 1);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prevPrev, prev, curr] = [prev, curr, prevPrev];
  }
  return prev[lb]!;
}

/** Lowercase + strip diacritics (NFD). */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}
