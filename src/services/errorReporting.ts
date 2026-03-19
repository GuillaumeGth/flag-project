import { supabase, getCachedUserId } from './supabase';
import { getCurrentRouteName } from './navigationRef';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Lazy import — Crashlytics native module may not be available in all environments
function getCrashlytics() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-firebase/crashlytics').default();
  } catch {
    return null;
  }
}

// Throttle: max 1 error report per context every 60 seconds
const THROTTLE_MS = 60_000;
const _lastReported = new Map<string, number>();

function isThrottled(context: string): boolean {
  const now = Date.now();
  const last = _lastReported.get(context);
  if (last && now - last < THROTTLE_MS) return true;
  _lastReported.set(context, now);
  return false;
}

// User context cache — set at login so it's available in error reports
let _cachedDisplayName: string | null = null;
let _cachedUsername: string | null = null;

export function setUserContext(displayName: string | null, username: string | null): void {
  _cachedDisplayName = displayName;
  _cachedUsername = username;
}

/**
 * Report an error to Firebase Crashlytics and the error_logs Supabase table.
 * Only active in production builds (__DEV__ === false).
 * Errors are throttled per context to avoid flooding.
 */
export async function reportError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // In dev: log to console so errors are visible during development
  if (__DEV__) {
    console.warn(`[reportError] ${context}:`, error);
    return;
  }

  if (isThrottled(context)) return;

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? (() => {
            try {
              const s = JSON.stringify(error);
              return s === '{}' ? String(error) : s;
            } catch {
              // Circular refs or non-serializable — extract known fields (e.g. PostgrestError)
              const e = error as Record<string, unknown>;
              const extracted: Record<string, unknown> = {};
              for (const key of ['message', 'code', 'details', 'hint', 'status']) {
                if (key in e) extracted[key] = e[key];
              }
              return Object.keys(extracted).length ? JSON.stringify(extracted) : String(error);
            }
          })()
        : String(error);
  const errorStack =
    error instanceof Error ? error.stack ?? null : null;

  const userId = getCachedUserId();
  const currentScreen = getCurrentRouteName();

  const enrichedMetadata = {
    ...metadata,
    platform: Platform.OS,
    os_version: String(Platform.Version),
    app_version: Constants.expoConfig?.version ?? 'unknown',
    ...(currentScreen ? { screen: currentScreen } : {}),
    ...(_cachedDisplayName ? { display_name: _cachedDisplayName } : {}),
    ...(_cachedUsername ? { username: _cachedUsername } : {}),
  };

  // --- Firebase Crashlytics ---
  try {
    const c = getCrashlytics();
    if (c) {
      if (userId) c.setUserId(userId);
      c.setAttribute('context', context);
      c.setAttribute('app_version', Constants.expoConfig?.version ?? 'unknown');
      if (currentScreen) c.setAttribute('screen', currentScreen);
      if (_cachedUsername) c.setAttribute('username', _cachedUsername);
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          c.setAttribute(key, String(value));
        }
      }
      c.recordError(error instanceof Error ? error : new Error(errorMessage));
    }
  } catch {
    // Silent fail
  }

  // --- Supabase error_logs table ---
  try {
    await supabase.from('error_logs').insert({
      error_message: errorMessage,
      error_context: context,
      error_stack: errorStack,
      user_id: userId,
      metadata: enrichedMetadata,
    });
  } catch {
    // Silent fail — we don't want error reporting to cause more errors
  }
}

/**
 * Call once at app startup to catch unhandled JS exceptions globally.
 * Forwards them to Crashlytics so they appear as fatal crashes.
 */
export function setupGlobalErrorHandler(): void {
  if (__DEV__) return;

  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      const c = getCrashlytics();
      if (c) {
        c.setAttribute('is_fatal', String(isFatal ?? false));
        c.recordError(error);
      }
    } catch {
      // Silent fail
    }

    originalHandler(error, isFatal);
  });
}
