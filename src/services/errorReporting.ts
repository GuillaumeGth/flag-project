import { supabase, getCachedUserId } from './supabase';
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
  // Only report in production
  if (__DEV__) return;

  if (isThrottled(context)) return;

  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack ?? null : null;

  const userId = getCachedUserId();

  // --- Firebase Crashlytics ---
  try {
    const c = getCrashlytics();
    if (c) {
      if (userId) c.setUserId(userId);
      c.setAttribute('context', context);
      c.setAttribute('app_version', Constants.expoConfig?.version ?? 'unknown');
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
      metadata: {
        ...metadata,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? 'unknown',
      },
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
