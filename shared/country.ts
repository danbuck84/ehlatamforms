import { COUNTRY_CODES, LATAM_FIRST, type CountryCode } from './constants';

/** Device timezone → country guess (LATAM + the most common others). */
const TZ_TO_COUNTRY: Readonly<Record<string, CountryCode>> = {
  'America/Sao_Paulo': 'BR',
  'America/Bahia': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Belem': 'BR',
  'America/Maceio': 'BR',
  'America/Araguaina': 'BR',
  'America/Manaus': 'BR',
  'America/Cuiaba': 'BR',
  'America/Campo_Grande': 'BR',
  'America/Porto_Velho': 'BR',
  'America/Boa_Vista': 'BR',
  'America/Rio_Branco': 'BR',
  'America/Santarem': 'BR',
  'America/Noronha': 'BR',
  'America/Eirunepe': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Argentina/Cordoba': 'AR',
  'America/Argentina/Mendoza': 'AR',
  'America/Argentina/Salta': 'AR',
  'America/Argentina/Tucuman': 'AR',
  'America/Argentina/Ushuaia': 'AR',
  'America/Santiago': 'CL',
  'America/Punta_Arenas': 'CL',
  'Pacific/Easter': 'CL',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Guadalajara': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Chihuahua': 'MX',
  'America/Hermosillo': 'MX',
  'America/Mazatlan': 'MX',
  'America/Tijuana': 'MX',
  'America/Lima': 'PE',
  'America/Montevideo': 'UY',
  'America/Guayaquil': 'EC',
  'Pacific/Galapagos': 'EC',
  'America/La_Paz': 'BO',
  'America/Asuncion': 'PY',
  'America/Caracas': 'VE',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Santo_Domingo': 'DO',
  'America/Guatemala': 'GT',
  'America/El_Salvador': 'SV',
  'America/Tegucigalpa': 'HN',
  'America/Managua': 'NI',
  'America/Havana': 'CU',
  'America/Puerto_Rico': 'PR',
  'Europe/Lisbon': 'PT',
  'Europe/Madrid': 'ES',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Asia/Tokyo': 'JP',
  'Australia/Sydney': 'AU',
};

export function guessCountryFromTimeZone(tz: string | null | undefined): CountryCode | null {
  if (!tz) return null;
  return TZ_TO_COUNTRY[tz] ?? null;
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  latam: boolean;
}

/** LATAM first (fixed order), then every other country A–Z in the UI language. */
export function buildCountryOptions(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }
  const nameOf = (c: string) => names?.of(c) ?? c;
  const latamSet = new Set<string>(LATAM_FIRST);
  const first = LATAM_FIRST.map((code) => ({ code, name: nameOf(code), latam: true }));
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const rest = COUNTRY_CODES.filter((c) => !latamSet.has(c))
    .map((code) => ({ code, name: nameOf(code), latam: false }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return [...first, ...rest];
}

/** Regional-indicator flag emoji for an ISO alpha-2 code. */
export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
