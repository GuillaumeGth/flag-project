import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedData,
  setCachedData,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  removeCachedData,
  clearAllCache,
  CACHE_KEYS,
} from '@/services/cache';

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCachedData', () => {
  it('returns parsed data when key exists', async () => {
    const data = { messages: [{ id: '1', text: 'hello' }] };
    mockStorage.getItem.mockResolvedValue(JSON.stringify(data));

    const result = await getCachedData<typeof data>('my_key');
    expect(result).toEqual(data);
    expect(mockStorage.getItem).toHaveBeenCalledWith('flag_cache_my_key');
  });

  it('returns null when key does not exist', async () => {
    mockStorage.getItem.mockResolvedValue(null);
    const result = await getCachedData('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null on AsyncStorage error', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('Storage error'));
    const result = await getCachedData('key');
    expect(result).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    mockStorage.getItem.mockResolvedValue('invalid-json{{{');
    const result = await getCachedData('key');
    expect(result).toBeNull();
  });
});

describe('setCachedData', () => {
  it('serializes data and stores it with cache prefix', async () => {
    const data = [{ id: '1', name: 'test' }];
    await setCachedData('my_key', data);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'flag_cache_my_key',
      JSON.stringify(data)
    );
  });

  it('does not throw on AsyncStorage error', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('Disk full'));
    await expect(setCachedData('key', { data: 'x' })).resolves.not.toThrow();
  });
});

describe('getLastSyncTimestamp', () => {
  it('returns the timestamp string when it exists', async () => {
    const ts = '2024-01-01T00:00:00.000Z';
    mockStorage.getItem.mockResolvedValue(ts);

    const result = await getLastSyncTimestamp('map_messages');
    expect(result).toBe(ts);
    expect(mockStorage.getItem).toHaveBeenCalledWith('flag_sync_map_messages');
  });

  it('returns null when no timestamp exists', async () => {
    mockStorage.getItem.mockResolvedValue(null);
    const result = await getLastSyncTimestamp('key');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('error'));
    const result = await getLastSyncTimestamp('key');
    expect(result).toBeNull();
  });
});

describe('setLastSyncTimestamp', () => {
  it('stores timestamp with sync prefix', async () => {
    const ts = '2024-06-15T12:00:00.000Z';
    await setLastSyncTimestamp('my_key', ts);
    expect(mockStorage.setItem).toHaveBeenCalledWith('flag_sync_my_key', ts);
  });

  it('does not throw on error', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('Fail'));
    await expect(setLastSyncTimestamp('key', '2024-01-01')).resolves.not.toThrow();
  });
});

describe('removeCachedData', () => {
  it('removes both cache and sync keys', async () => {
    await removeCachedData('my_key');
    expect(mockStorage.multiRemove).toHaveBeenCalledWith([
      'flag_cache_my_key',
      'flag_sync_my_key',
    ]);
  });

  it('does not throw on error', async () => {
    mockStorage.multiRemove.mockRejectedValue(new Error('Fail'));
    await expect(removeCachedData('key')).resolves.not.toThrow();
  });
});

describe('clearAllCache', () => {
  it('removes all keys starting with flag_cache_ or flag_sync_', async () => {
    mockStorage.getAllKeys.mockResolvedValue([
      'flag_cache_map_messages',
      'flag_sync_map_messages',
      'flag_cache_conversations_messages',
      'other_app_key',
      'expo_token',
    ]);

    await clearAllCache();

    expect(mockStorage.multiRemove).toHaveBeenCalledWith([
      'flag_cache_map_messages',
      'flag_sync_map_messages',
      'flag_cache_conversations_messages',
    ]);
  });

  it('does not call multiRemove when no cache keys exist', async () => {
    mockStorage.getAllKeys.mockResolvedValue(['other_key_1', 'other_key_2']);
    await clearAllCache();
    expect(mockStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('handles empty storage gracefully', async () => {
    mockStorage.getAllKeys.mockResolvedValue([]);
    await clearAllCache();
    expect(mockStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('does not throw on getAllKeys error', async () => {
    mockStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));
    await expect(clearAllCache()).resolves.not.toThrow();
  });
});

describe('CACHE_KEYS', () => {
  it('has the correct static keys', () => {
    expect(CACHE_KEYS.CONVERSATIONS_MESSAGES).toBe('conversations_messages');
    expect(CACHE_KEYS.MAP_MESSAGES).toBe('map_messages');
    expect(CACHE_KEYS.USERS).toBe('users');
  });

  it('generates unique per-user conversation keys', () => {
    const key1 = CACHE_KEYS.CONVERSATION('user-abc');
    const key2 = CACHE_KEYS.CONVERSATION('user-xyz');
    expect(key1).toBe('conversation_user-abc');
    expect(key2).toBe('conversation_user-xyz');
    expect(key1).not.toBe(key2);
  });
});
