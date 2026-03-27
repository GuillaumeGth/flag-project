/**
 * Tests for src/i18n
 *
 * Covers:
 * 1. Cohérence des clés — toutes les clés de fr.ts existent dans en, es, pt, de
 * 2. getDeviceLanguage — langue supportée, non supportée, fallback 'en'
 * 3. getInitialLanguage — AsyncStorage vide, langue valide, langue invalide, erreur
 * 4. saveLanguage — écrit dans AsyncStorage, gère les erreurs silencieusement
 */

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// i18next needs to be mocked so initI18n doesn't actually boot during tests
jest.mock('i18next', () => ({
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockResolvedValue(undefined),
  language: 'en',
  changeLanguage: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: {},
}));

import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceLanguage, getInitialLanguage, saveLanguage } from '@/i18n';
import fr from '@/i18n/locales/fr';
import en from '@/i18n/locales/en';
import es from '@/i18n/locales/es';
import pt from '@/i18n/locales/pt';
import de from '@/i18n/locales/de';
import type { Translations } from '@/i18n/locales/fr';

const mockLocalization = Localization as jest.Mocked<typeof Localization>;
const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAllKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? getAllKeys(value, fullKey)
      : [fullKey];
  });
}

// ─── 1. Cohérence des clés entre locales ────────────────────────────────────

describe('Cohérence des fichiers de traduction', () => {
  const frKeys = getAllKeys(fr).sort();

  const locales: [string, Translations][] = [
    ['en', en],
    ['es', es],
    ['pt', pt],
    ['de', de],
  ];

  it.each(locales)('%s a toutes les clés de fr', (_name, locale) => {
    const localeKeys = getAllKeys(locale).sort();
    expect(localeKeys).toEqual(frKeys);
  });

  it.each(locales)('%s n\'a aucune valeur vide', (_name, locale) => {
    const keys = getAllKeys(locale);
    keys.forEach((key) => {
      const parts = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = parts.reduce((obj: any, k) => obj?.[k], locale);
      expect(value).toBeTruthy();
    });
  });

  it('fr n\'a aucune valeur vide', () => {
    const keys = getAllKeys(fr);
    keys.forEach((key) => {
      const parts = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = parts.reduce((obj: any, k) => obj?.[k], fr);
      expect(value).toBeTruthy();
    });
  });
});

// ─── 2. getDeviceLanguage ────────────────────────────────────────────────────

describe('getDeviceLanguage', () => {
  it('retourne la langue du device si supportée', () => {
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'fr' }] as any);
    expect(getDeviceLanguage()).toBe('fr');
  });

  it('retourne "en" si la langue du device n\'est pas supportée', () => {
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'zh' }] as any);
    expect(getDeviceLanguage()).toBe('en');
  });

  it('retourne "en" si getLocales retourne un tableau vide', () => {
    mockLocalization.getLocales.mockReturnValue([]);
    expect(getDeviceLanguage()).toBe('en');
  });

  it('retourne "en" si languageCode est null', () => {
    mockLocalization.getLocales.mockReturnValue([{ languageCode: null }] as any);
    expect(getDeviceLanguage()).toBe('en');
  });

  it.each(['fr', 'en', 'es', 'pt', 'de'])('reconnaît "%s" comme langue supportée', (lang) => {
    mockLocalization.getLocales.mockReturnValue([{ languageCode: lang }] as any);
    expect(getDeviceLanguage()).toBe(lang);
  });
});

// ─── 3. getInitialLanguage ───────────────────────────────────────────────────

describe('getInitialLanguage', () => {
  it('retourne la langue persistée si valide', async () => {
    mockStorage.getItem.mockResolvedValue('es');
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'fr' }] as any);

    const result = await getInitialLanguage();
    expect(result).toBe('es');
  });

  it('retourne la langue du device si AsyncStorage est vide', async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'de' }] as any);

    const result = await getInitialLanguage();
    expect(result).toBe('de');
  });

  it('retourne la langue du device si la valeur persistée n\'est pas supportée', async () => {
    mockStorage.getItem.mockResolvedValue('zh');
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'pt' }] as any);

    const result = await getInitialLanguage();
    expect(result).toBe('pt');
  });

  it('retourne "en" si AsyncStorage échoue et device non supporté', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('Storage unavailable'));
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'ja' }] as any);

    const result = await getInitialLanguage();
    expect(result).toBe('en');
  });

  it('retourne "en" si AsyncStorage échoue et device est vide', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('Storage unavailable'));
    mockLocalization.getLocales.mockReturnValue([]);

    const result = await getInitialLanguage();
    expect(result).toBe('en');
  });

  it('la langue persistée prend la priorité sur la langue du device', async () => {
    mockStorage.getItem.mockResolvedValue('pt');
    mockLocalization.getLocales.mockReturnValue([{ languageCode: 'en' }] as any);

    const result = await getInitialLanguage();
    expect(result).toBe('pt');
    expect(mockLocalization.getLocales).not.toHaveBeenCalled();
  });
});

// ─── 4. saveLanguage ─────────────────────────────────────────────────────────

describe('saveLanguage', () => {
  it('écrit la langue dans AsyncStorage', async () => {
    mockStorage.setItem.mockResolvedValue(undefined);
    await saveLanguage('es');
    expect(mockStorage.setItem).toHaveBeenCalledWith('app_language', 'es');
  });

  it('ne lève pas d\'erreur si AsyncStorage échoue', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('Storage full'));
    await expect(saveLanguage('fr')).resolves.toBeUndefined();
  });
});
