import {
  LEVELS,
  ROLES,
  SPEAKING,
  isCountryCode,
  type CountryCode,
  type Level,
  type Rating,
  type Role,
  type Speaking,
} from '../../../shared/constants';
import { deviceTimeZone } from '../../../shared/time';
import { guessCountryFromTimeZone } from '../../../shared/country';

export interface CheckinDraft {
  email: string;
  country: CountryCode | '';
  role: Role | null;
  speaking: Speaking | null;
  level: Level | null;
  rating: Rating | null;
  keyword: string;
  comment: string;
  topicSuggestion: string;
  step: 1 | 2 | 3;
}

export interface ReturningProfile {
  email: string;
  country: CountryCode;
  role: Role | null;
}

const PROFILE_KEY = 'englishtalk:profile';
const draftKey = (sessionId: string) => `englishtalk:draft:${sessionId}`;

export function loadReturningProfile(): ReturningProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ReturningProfile>;
    if (
      typeof data.email === 'string' &&
      data.email.includes('@') &&
      typeof data.country === 'string' &&
      isCountryCode(data.country)
    ) {
      const role = data.role && (ROLES as readonly string[]).includes(data.role) ? data.role : null;
      return { email: data.email, country: data.country, role };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function saveReturningProfile(profile: ReturningProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

export function clearReturningProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function loadInitialDraft(sessionId: string): {
  draft: CheckinDraft;
  prefilledEmail: string | null;
} {
  const profile = loadReturningProfile();
  const tzGuess = guessCountryFromTimeZone(deviceTimeZone());

  const fallback: CheckinDraft = {
    email: profile?.email ?? '',
    country: profile?.country ?? tzGuess ?? '',
    role: profile?.role ?? null,
    speaking: null,
    level: null,
    rating: null,
    keyword: '',
    comment: '',
    topicSuggestion: '',
    step: 1,
  };

  try {
    const raw = sessionStorage.getItem(draftKey(sessionId));
    if (!raw) {
      return { draft: fallback, prefilledEmail: profile?.email ?? null };
    }
    const parsed = JSON.parse(raw) as Partial<CheckinDraft>;
    const country =
      typeof parsed.country === 'string' && isCountryCode(parsed.country)
        ? parsed.country
        : fallback.country;
    const role = parsed.role && (ROLES as readonly string[]).includes(parsed.role) ? parsed.role : null;
    const speaking =
      parsed.speaking && (SPEAKING as readonly string[]).includes(parsed.speaking) ? parsed.speaking : null;
    const level = parsed.level && (LEVELS as readonly string[]).includes(parsed.level) ? parsed.level : null;
    const rating =
      typeof parsed.rating === 'number' && parsed.rating >= 1 && parsed.rating <= 5
        ? (parsed.rating as Rating)
        : null;
    const step = parsed.step === 2 || parsed.step === 3 ? parsed.step : 1;

    return {
      draft: {
        email: typeof parsed.email === 'string' ? parsed.email : fallback.email,
        country,
        role,
        speaking,
        level,
        rating,
        keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '',
        comment: typeof parsed.comment === 'string' ? parsed.comment : '',
        topicSuggestion: typeof parsed.topicSuggestion === 'string' ? parsed.topicSuggestion : '',
        step,
      },
      prefilledEmail: profile?.email ?? null,
    };
  } catch {
    return { draft: fallback, prefilledEmail: profile?.email ?? null };
  }
}

export function saveDraft(sessionId: string, draft: CheckinDraft): void {
  try {
    sessionStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearDraft(sessionId: string): void {
  try {
    sessionStorage.removeItem(draftKey(sessionId));
  } catch {
    // ignore
  }
}
