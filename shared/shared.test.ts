import { describe, expect, it } from 'vitest';
import {
  canonicalEmail,
  emailDomain,
  isBlockedDomain,
  isValidEmailShape,
  normalizeEmail,
  suggestDomain,
  suggestEmail,
} from './email';
import { compactKeyword, matchKeyword } from './keyword';
import { acceptCheckin, computeWindow, isOpenAt, selectCurrent, windowState } from './window';
import {
  addDaysToDateKey,
  formatClassMoment,
  formatTime,
  getZonedParts,
  isoWeekdayOfDateKey,
  splitDuration,
  zonedDateKey,
  zonedTimeKey,
  zonedWallTimeToUtc,
} from './time';
import { checkinRequestSchema } from './schemas';
import { csvEscape, toCsv } from './csv';
import { buildCountryOptions, flagEmoji, guessCountryFromTimeZone } from './country';

describe('email normalization and canonicalization', () => {
  it('trims and lowercases raw emails', () => {
    expect(normalizeEmail('  Maria.Silva@Gmail.COM ')).toBe('maria.silva@gmail.com');
    expect(emailDomain('  Maria@Rocketseat.Team ')).toBe('rocketseat.team');
  });

  it('canonicalizes Gmail dots, +tags and googlemail.com alias', () => {
    expect(canonicalEmail('m.a.r.i.a+oct27@gmail.com')).toBe('maria@gmail.com');
    expect(canonicalEmail('Maria.Silva+test@googlemail.com')).toBe('mariasilva@gmail.com');
  });

  it('strips +tags but keeps dots for non-Gmail domains', () => {
    expect(canonicalEmail('maria.silva+class@hotmail.com')).toBe('maria.silva@hotmail.com');
    expect(canonicalEmail('first.last+tag@empresa.com.br')).toBe('first.last@empresa.com.br');
  });

  it('suggests corrections for common typo domains and TLD typos', () => {
    expect(suggestEmail('maria@gmial.com')).toBe('maria@gmail.com');
    expect(suggestEmail('carlos@hotrmail.com')).toBe('carlos@hotmail.com');
    expect(suggestEmail('ana@hormail.com')).toBe('ana@hotmail.com');
    expect(suggestEmail('pedro@hotmail.om')).toBe('pedro@hotmail.com');
    expect(suggestEmail('luiza@hmail.com')).toBe('luiza@gmail.com');
    expect(suggestEmail('joao@outlok.com')).toBe('joao@outlook.com');
    expect(suggestEmail('user@gmail.con')).toBe('user@gmail.com');
    expect(suggestEmail('user@yahoo.cm')).toBe('user@yahoo.com');
    expect(suggestDomain('gmail.com')).toBeNull();
    expect(suggestDomain('rocketseat.com.br')).toBeNull();
  });

  it('blocks known-bad typo domains while allowing corporate/university domains', () => {
    for (const bad of [
      'gmial.com',
      'gmai.com',
      'gnail.com',
      'hotrmail.com',
      'hormail.com',
      'homail.com',
      'hmail.com',
      'hotmail.om',
      'outlok.com',
      'gmail.con',
      'hotmail.cm',
    ]) {
      expect(isBlockedDomain(bad), bad).toBe(true);
    }
    for (const ok of ['gmail.com', 'hotmail.com', 'rocketseat.team', 'usp.br', 'uniandes.edu.co']) {
      expect(isBlockedDomain(ok), ok).toBe(false);
    }
  });

  it('validates basic email shapes', () => {
    expect(isValidEmailShape('student@gmail.com')).toBe(true);
    expect(isValidEmailShape('not-an-email')).toBe(false);
    expect(isValidEmailShape('missing@tld')).toBe(false);
  });
});

describe('keyword normalization and fuzzy matching', () => {
  it('folds case, diacritics, spaces, hyphens and punctuation', () => {
    expect(compactKeyword('TRADE-OFF')).toBe('tradeoff');
    expect(compactKeyword('trade off')).toBe('tradeoff');
    expect(compactKeyword('trade_off!')).toBe('tradeoff');
    expect(compactKeyword('Café ☕')).toBe('cafe');
  });

  it('matches exact compact forms across formatting variations', () => {
    expect(matchKeyword('TRADE-OFF', 'trade off', true)).toBe('exact');
    expect(matchKeyword('tradeoff', 'TRADE-OFF', true)).toBe('exact');
  });

  it('accepts Damerau-Levenshtein distance <= 1 when fuzzy=true and length >= 5', () => {
    expect(matchKeyword('tradeof', 'tradeoff', true)).toBe('fuzzy'); // deletion
    expect(matchKeyword('tradoeff', 'tradeoff', true)).toBe('fuzzy'); // transposition
    expect(matchKeyword('tradoff', 'tradeoff', false)).toBeNull(); // fuzzy disabled
    expect(matchKeyword('cat', 'coat', true)).toBeNull(); // shorter than 5 chars
    expect(matchKeyword('totallywrong', 'tradeoff', true)).toBeNull();
  });
});

describe('12-hour check-in window logic (12:00 BRT to 00:00 BRT)', () => {
  // Class on Tue 2026-10-27 at 18:00 BRT (21:00 UTC)
  const startsAtMs = zonedWallTimeToUtc('2026-10-27', '18:00', 'America/Sao_Paulo');
  const session = {
    id: '2026-10-27',
    startsAtMs,
    opensOffsetMin: 360, // 6h before -> 12:00 BRT (15:00 UTC)
    closesOffsetMin: 360, // 6h after  -> 00:00 BRT Wed (03:00 UTC Wed)
    status: 'scheduled' as const,
  };

  it('computes opensAt = 12:00 BRT and closesAt = 00:00 BRT next day by default', () => {
    const w = computeWindow(session);
    expect(new Date(w.opensAtMs).toISOString()).toBe('2026-10-27T15:00:00.000Z');
    expect(new Date(w.closesAtMs).toISOString()).toBe('2026-10-28T03:00:00.000Z');
    expect(zonedTimeKey(w.opensAtMs, 'America/Sao_Paulo')).toBe('12:00');
    expect(zonedDateKey(w.closesAtMs, 'America/Sao_Paulo')).toBe('2026-10-28');
    expect(zonedTimeKey(w.closesAtMs, 'America/Sao_Paulo')).toBe('00:00');
  });

  it('checks exact boundaries to the second (±1s)', () => {
    const tue115959 = zonedWallTimeToUtc('2026-10-27', '11:59', 'America/Sao_Paulo') + 59_000;
    const tue120000 = zonedWallTimeToUtc('2026-10-27', '12:00', 'America/Sao_Paulo');
    const tue193000 = zonedWallTimeToUtc('2026-10-27', '19:30', 'America/Sao_Paulo');
    const tue235959 = zonedWallTimeToUtc('2026-10-27', '23:59', 'America/Sao_Paulo') + 59_000;
    const wed000000 = zonedWallTimeToUtc('2026-10-28', '00:00', 'America/Sao_Paulo');

    expect(windowState(session, tue115959)).toBe('not_yet_open');
    expect(isOpenAt(session, tue115959)).toBe(false);

    expect(windowState(session, tue120000)).toBe('open');
    expect(isOpenAt(session, tue120000)).toBe(true);

    expect(windowState(session, tue193000)).toBe('open');
    expect(windowState(session, tue235959)).toBe('open');

    expect(windowState(session, wed000000)).toBe('closed');
    expect(isOpenAt(session, wed000000)).toBe(false);
  });

  it('never opens cancelled sessions and supports custom offsets', () => {
    const tue1800 = startsAtMs;
    expect(isOpenAt({ ...session, status: 'cancelled' }, tue1800)).toBe(false);
    const custom = { ...session, opensOffsetMin: 60, closesOffsetMin: 120 };
    expect(isOpenAt(custom, startsAtMs - 61 * 60_000)).toBe(false);
    expect(isOpenAt(custom, startsAtMs - 60 * 60_000)).toBe(true);
    expect(isOpenAt(custom, startsAtMs + 119 * 60_000)).toBe(true);
    expect(isOpenAt(custom, startsAtMs + 120 * 60_000)).toBe(false);
  });

  it('selects open and next sessions across Tue/Thu schedule without overlap', () => {
    const thu = {
      id: '2026-10-29',
      startsAtMs: zonedWallTimeToUtc('2026-10-29', '18:00', 'America/Sao_Paulo'),
      status: 'scheduled' as const,
    };
    const wedNoon = zonedWallTimeToUtc('2026-10-28', '12:00', 'America/Sao_Paulo');
    const res = selectCurrent([session, thu], wedNoon);
    expect(res.open).toHaveLength(0);
    expect(res.next?.id).toBe('2026-10-29');
  });

  it('accepts offline submissions captured inside the window within 48h after close as late=true', () => {
    const capturedInside = zonedWallTimeToUtc('2026-10-27', '19:05', 'America/Sao_Paulo');
    const afterClose2h = zonedWallTimeToUtc('2026-10-28', '02:00', 'America/Sao_Paulo');
    const afterClose50h = zonedWallTimeToUtc('2026-10-30', '05:00', 'America/Sao_Paulo');

    expect(acceptCheckin(session, afterClose2h, capturedInside)).toEqual({ ok: true, late: true });
    expect(acceptCheckin(session, afterClose50h, capturedInside)).toEqual({ ok: false, reason: 'closed' });
    // Captured outside the window -> rejected after close
    expect(acceptCheckin(session, afterClose2h, afterClose2h)).toEqual({ ok: false, reason: 'closed' });
  });
});

describe('timezone display for BR / AR / CL / CO / PE / MX', () => {
  const startsAtMs = zonedWallTimeToUtc('2026-10-27', '18:00', 'America/Sao_Paulo');

  it('converts 18:00 BRT to the expected local wall-clock hour across Latin America', () => {
    expect(getZonedParts(startsAtMs, 'America/Sao_Paulo').hour).toBe(18); // UTC-3
    expect(getZonedParts(startsAtMs, 'America/Argentina/Buenos_Aires').hour).toBe(18); // UTC-3
    expect(getZonedParts(startsAtMs, 'America/Santiago').hour).toBe(18); // CL summer UTC-3
    expect(getZonedParts(startsAtMs, 'America/Bogota').hour).toBe(16); // UTC-5
    expect(getZonedParts(startsAtMs, 'America/Lima').hour).toBe(16); // UTC-5
    expect(getZonedParts(startsAtMs, 'America/Mexico_City').hour).toBe(15); // UTC-6
  });

  it('formats class moments and durations cleanly', () => {
    expect(formatClassMoment(startsAtMs, 'en', 'America/Sao_Paulo')).toContain('Oct 27');
    expect(formatTime(startsAtMs, 'pt', 'America/Sao_Paulo')).toContain('18');
    expect(addDaysToDateKey('2026-10-27', 2)).toBe('2026-10-29');
    expect(isoWeekdayOfDateKey('2026-10-27')).toBe(2);
    expect(splitDuration(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });
});

describe('Zod schemas, country helpers and CSV export', () => {
  it('validates a complete check-in payload and rejects unknown fields', () => {
    const valid = {
      sessionId: '2026-10-27',
      email: ' Maria@Gmail.com ',
      country: 'BR',
      role: 'rocketseat_student',
      speaking: 'a_lot',
      level: 'just_right',
      rating: 5,
      keyword: 'trade-off',
      comment: 'Great class!',
      topicSuggestion: 'AI in daily work',
      uiLanguage: 'en',
      clientSubmissionId: '3e18f69f-521d-4d9e-ac8a-086e07587d14',
      clientCapturedAt: '2026-10-27T21:50:00.000Z',
      elapsedMs: 12_000,
      website: '',
      appVersion: '0.1.0',
    };
    const res = checkinRequestSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.email).toBe('maria@gmail.com');

    expect(checkinRequestSchema.safeParse({ ...valid, extraField: 123 }).success).toBe(false);
    expect(checkinRequestSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });

  it('orders LATAM countries first and guesses country from timezone', () => {
    const list = buildCountryOptions('pt');
    expect(list[0]?.code).toBe('BR');
    expect(list[1]?.code).toBe('AR');
    expect(guessCountryFromTimeZone('America/Bogota')).toBe('CO');
    expect(flagEmoji('BR')).toBe('🇧🇷');
  });

  it('escapes quotes, newlines and spreadsheet formulas in CSV', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvEscape('hello, "world"')).toBe('"hello, ""world"""');
    const csv = toCsv([{ a: '1', b: '+cmd' }], ['a', 'b']);
    expect(csv).toBe("\uFEFFa,b\r\n1,'+cmd\r\n");
  });
});
