import { APP_CONFIG } from '../src/config/app';

export const UI_LANGUAGES = ['en', 'pt', 'es'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const ROLES = ['rocketseat_student', 'digital_house_student', 'dhrs_team', 'other'] as const;
export type Role = (typeof ROLES)[number];

export const SPEAKING = ['a_lot', 'a_little', 'chat_only', 'listened'] as const;
export type Speaking = (typeof SPEAKING)[number];

export const LEVELS = ['too_easy', 'a_bit_easy', 'just_right', 'a_bit_hard', 'too_hard'] as const;
export type Level = (typeof LEVELS)[number];

export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

export const KEYWORD_MATCH = ['exact', 'fuzzy', 'not_required'] as const;
export type KeywordMatch = (typeof KEYWORD_MATCH)[number];

export const LIMITS = {
  emailMax: 254,
  commentMax: 1000,
  topicMax: 200,
  keywordMax: 100,
  /** A human cannot fill 3 steps faster than this. */
  minTimeToSubmitMs: 4000,
  wrongKeyword: { max: 5, windowSec: 10 * 60 },
  ipRequests: { max: 20, windowSec: 10 * 60 },
  /** Strict tier used when App Check is missing/invalid in soft mode. */
  ipRequestsStrict: { max: 8, windowSec: 10 * 60 },
} as const;

export const WINDOW_DEFAULTS = {
  opensOffsetMin: APP_CONFIG.DEFAULT_OPENS_OFFSET_MIN,
  closesOffsetMin: APP_CONFIG.DEFAULT_CLOSES_OFFSET_MIN,
  graceMs: APP_CONFIG.OFFLINE_GRACE_HOURS * 60 * 60 * 1000,
} as const;

export const TIMEZONE = APP_CONFIG.TIMEZONE;

/** Latin American countries shown first in the country picker, in this order. */
export const LATAM_FIRST = [
  'BR',
  'AR',
  'CL',
  'CO',
  'MX',
  'PE',
  'UY',
  'EC',
  'BO',
  'PY',
  'VE',
  'CR',
  'PA',
  'DO',
  'GT',
] as const;

/** ISO 3166-1 alpha-2 codes accepted by the API. */
export const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);
export function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_SET.has(value);
}
