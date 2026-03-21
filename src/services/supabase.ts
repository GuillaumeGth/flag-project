import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { AppState } from 'react-native';
import { reportError } from './errorReporting';
import { log } from '@/utils/debug';

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

// SecureStore has a 2048 byte limit per value. Supabase session JSON (access token +
// user object with Google metadata + identities) easily exceeds this. We chunk large
// values across multiple SecureStore entries to avoid silent storage failures.
const CHUNK_SIZE = 1800; // conservative limit well below 2048 bytes

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check if value was stored in chunks
      const countStr = await SecureStore.getItemAsync(`${key}.chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}.chunk-${i}`);
          if (chunk === null) return null;
          parts.push(chunk);
        }
        return parts.join('');
      }
      // Fallback: value stored directly (no chunking)
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      reportError(error, 'secureStore.getItem');
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length > CHUNK_SIZE) {
        // Store in chunks
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }
        await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length));
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}.chunk-${i}`, chunks[i]);
        }
        // Clean up any previous non-chunked value
        await SecureStore.deleteItemAsync(key).catch(() => {});
      } else {
        await SecureStore.setItemAsync(key, value);
        // Clean up any previous chunked value
        await SecureStore.deleteItemAsync(`${key}.chunks`).catch(() => {});
      }
    } catch (error) {
      reportError(error, 'secureStore.setItem');
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      // Remove chunks if they exist
      const countStr = await SecureStore.getItemAsync(`${key}.chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        await SecureStore.deleteItemAsync(`${key}.chunks`);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}.chunk-${i}`);
        }
      }
      // Also remove direct value (handles non-chunked entries)
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      reportError(error, 'secureStore.removeItem');
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

// Kick off Supabase initialization: reading session from SecureStore.
// This triggers the internal _initializePromise so that subsequent getSession()
// calls resolve quickly rather than waiting for a cold start.
supabase.auth.getSession().then(({ data: { session } }) => {
  _cachedUserId = session?.user?.id ?? null;
  log('[supabase] initial getSession resolved, cachedUserId:', _cachedUserId);
});

// Keep cached userId in sync with auth state changes (sign-in, sign-out, token refresh)
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id ?? null;
});

// React Native suspends JS timers in background, so Supabase's auto-refresh setInterval
// never fires after long inactivity — the token expires silently. Restart auto-refresh
// whenever the app becomes active so the token is refreshed immediately on resume.
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export function getCachedUserId(): string | null {
  return _cachedUserId;
}
