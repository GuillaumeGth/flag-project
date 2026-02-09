import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Get Supabase config from Constants (app.json extra) or env vars
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

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
