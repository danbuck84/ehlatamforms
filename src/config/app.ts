/**
 * Central app configuration.
 * Renaming the app (or changing the brand colors / timezone / window defaults)
 * must be a one-file change: edit this file only.
 *
 * This file must stay dependency-free: it is imported by the browser bundle,
 * the Netlify Functions and the build scripts (manifest, icons).
 */
export const APP_CONFIG = {
  APP_NAME: 'EnglishTalk',
  SHORT_NAME: 'EnglishTalk',
  TAGLINE: 'Check in to your English conversation class',
  CO_BRAND: 'English Hub Rocketseat | LATAM English Conversation 🌎',
  TEACHER_NAME: 'Teacher Dan',

  /** All class times are defined in this IANA timezone. */
  TIMEZONE: 'America/Sao_Paulo',
  /** Human label for TIMEZONE used in the UI. */
  TIMEZONE_LABEL: 'Brasília',

  /**
   * Default check-in window, in minutes relative to the class start.
   * Owner decision: 12 h in total → 6 h before and 6 h after the start
   * (e.g. an 18:00 class is open from 12:00 to 00:00 of the next day).
   */
  DEFAULT_OPENS_OFFSET_MIN: 360,
  DEFAULT_CLOSES_OFFSET_MIN: 360,

  /** Default class schedule used by the admin session generator. */
  DEFAULT_CLASS_WEEKDAYS: [2, 4] as readonly number[], // ISO weekday: 2 = Tue, 4 = Thu
  DEFAULT_CLASS_START: '18:00',
  DEFAULT_CLASS_END: '19:00',
  DEFAULT_GENERATOR_START_DATE: '2026-10-27',

  /** Offline submissions are accepted up to this long after the window closes. */
  OFFLINE_GRACE_HOURS: 48,

  THEME: {
    primary: '#8257E5',
    accent: '#04D361',
    background: '#121214',
    surface: '#202024',
    border: '#323238',
    text: '#E1E1E6',
    textSecondary: '#A8A8B3',
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
