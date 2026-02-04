import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Get Supabase config from Constants (app.json extra) or env vars
// Try multiple sources for compatibility with different build types
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  Constants.manifest?.extra?.supabaseUrl ||
  (Constants as any).manifest2?.extra?.expoClient?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  Constants.manifest?.extra?.supabaseAnonKey ||
  (Constants as any).manifest2?.extra?.expoClient?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Debug logging for production issues
console.log('[Supabase] URL configured:', supabaseUrl ? 'Yes' : 'No');
console.log('[Supabase] Key configured:', supabaseAnonKey ? 'Yes' : 'No');
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing configuration!', {
    hasExpoConfig: !!Constants.expoConfig,
    hasManifest: !!Constants.manifest,
    hasManifest2: !!(Constants as any).manifest2,
  });
}

// Custom storage using SecureStore for sensitive data
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.log('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.log('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.log('SecureStore removeItem error:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
