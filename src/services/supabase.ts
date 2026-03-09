import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Hardcoded fallbacks — last resort if Constants.expoConfig or process.env are unavailable
// (can happen in production bare workflow builds when the native ExponentConstants module
// fails to load the embedded app.config asset)
const _SUPABASE_URL = 'https://svhrpzlhqauyarcffpii.supabase.co';
const _SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aHJwemxocWF1eWFyY2ZmcGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTUwMTcsImV4cCI6MjA4NTQ3MTAxN30.XqKUpriPey1lhIpsmjF4Zcgjfeml2DtjGHlL7N-Jfqk';

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || _SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  _SUPABASE_ANON_KEY;

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

// Cached user ID — updated synchronously by auth state changes.
// Use getCachedUserId() instead of getSession() in data-fetching functions
// to avoid deadlocking on the internal Supabase auth lock.
let _cachedUserId: string | null = null;

// Resolves once Supabase's internal _initializePromise completes (SecureStore read done).
// Await this instead of getSession() inside onAuthStateChange to avoid deadlock.
export const supabaseReady = supabase.auth.getSession().then(({ data: { session } }) => {
  _cachedUserId = session?.user?.id ?? null;
  console.log('[supabase] supabaseReady resolved, cachedUserId:', _cachedUserId);
});

// Keep cached userId in sync with auth state changes (sign-in, sign-out, token refresh)
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id ?? null;
});

export function getCachedUserId(): string | null {
  return _cachedUserId;
}
