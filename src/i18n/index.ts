import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { UI_LANGUAGES, type UiLanguage } from '../../shared/constants';
import en from './en.json';

const STORAGE_KEY = 'englishtalk:lang';

const loaders: Record<UiLanguage, () => Promise<{ default: typeof en }>> = {
  en: async () => ({ default: en }),
  pt: () => import('./pt.json'),
  es: () => import('./es.json'),
};

export function resolveSupportedLanguage(raw: string | null | undefined): UiLanguage | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (code.startsWith('pt')) return 'pt';
  if (code.startsWith('es')) return 'es';
  if (code.startsWith('en')) return 'en';
  return null;
}

export function detectInitialLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'en';

  // 1. ?lang=es query param override
  try {
    const param = new URLSearchParams(window.location.search).get('lang');
    const fromParam = resolveSupportedLanguage(param);
    if (fromParam) {
      localStorage.setItem(STORAGE_KEY, fromParam);
      return fromParam;
    }
  } catch {
    // ignore URL errors
  }

  // 2. Persisted manual choice
  try {
    const saved = resolveSupportedLanguage(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // ignore storage errors
  }

  // 3. Browser languages (any pt* -> pt, any es* -> es, else en)
  const navLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of navLangs) {
    const matched = resolveSupportedLanguage(candidate);
    if (matched) return matched;
  }
  return 'en';
}

export async function setAppLanguage(lang: UiLanguage): Promise<void> {
  if (!UI_LANGUAGES.includes(lang)) return;
  if (!i18n.hasResourceBundle(lang, 'translation')) {
    const mod = await loaders[lang]();
    i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
  }
  await i18n.changeLanguage(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-419' : 'en';
  }
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }
}

let initialized = false;
export async function initI18n(): Promise<typeof i18n> {
  if (initialized) return i18n;
  initialized = true;
  const initial = detectInitialLanguage();
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  await setAppLanguage(initial);
  return i18n;
}

export { i18n };
