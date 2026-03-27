import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import fr from './locales/fr';
import en from './locales/en';
import es from './locales/es';
import pt from './locales/pt';
import de from './locales/de';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'pt', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
};

const LANGUAGE_STORAGE_KEY = 'app_language';

export function getDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  const code = locales[0]?.languageCode ?? 'en';
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
    return code as SupportedLanguage;
  }
  return 'en';
}

export async function getInitialLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // fall through to device language
  }
  return getDeviceLanguage();
}

export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // non-critical
  }
}

const initI18n = async () => {
  const lng = await getInitialLanguage();

  await i18next.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      pt: { translation: pt },
      de: { translation: de },
    },
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });
};

export { i18next };
export default initI18n;
