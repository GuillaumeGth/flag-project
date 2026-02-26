import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, warn } from '@/utils/debug';

const CACHE_PREFIX = 'flag_cache_';
const SYNC_PREFIX = 'flag_sync_';

/**
 * Local cache service for storing data on device and enabling incremental sync.
 *
 * Strategy:
 * - Each data type has a cache key and a last-sync timestamp
 * - On fetch: return cached data immediately, then fetch only newer data
 * - Merge new data into cache and update the sync timestamp
 */

// --- Generic cache operations ---

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    warn('cache', 'getCachedData error:', key, e);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    warn('cache', 'setCachedData error:', key, e);
  }
}

export async function getLastSyncTimestamp(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SYNC_PREFIX + key);
  } catch (e) {
    warn('cache', 'getLastSyncTimestamp error:', key, e);
    return null;
  }
}

export async function setLastSyncTimestamp(key: string, timestamp: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_PREFIX + key, timestamp);
  } catch (e) {
    warn('cache', 'setLastSyncTimestamp error:', key, e);
  }
}

export async function removeCachedData(key: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHE_PREFIX + key, SYNC_PREFIX + key]);
  } catch (e) {
    warn('cache', 'removeCachedData error:', key, e);
  }
}

/**
 * Clear all cached data (call on logout).
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      k => k.startsWith(CACHE_PREFIX) || k.startsWith(SYNC_PREFIX)
    );
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
    log('cache', 'cleared all cache:', cacheKeys.length, 'keys');
  } catch (e) {
    warn('cache', 'clearAllCache error:', e);
  }
}

// --- Cache keys ---
export const CACHE_KEYS = {
  CONVERSATIONS_MESSAGES: 'conversations_messages', // all messages for building conversations
  MAP_MESSAGES: 'map_messages', // undiscovered messages for map
  CONVERSATION: (otherUserId: string) => `conversation_${otherUserId}`,
  USERS: 'users',
};
