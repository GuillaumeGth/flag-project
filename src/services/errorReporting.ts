import { supabase, getCachedUserId } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
 * Report an error to the error_logs table.
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
