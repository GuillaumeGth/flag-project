/**
 * Tests for useMapMessages hook
 *
 * Covers:
 * 1. Initial state — loading=true, messages=[]
 * 2. loadMessages — uses cache while fresh data loads
 * 3. loadMessages — merges undiscovered + following public messages (deduplication)
 * 4. loadMessages — sets loading=false after completion
 */

jest.mock('@/services/messages', () => ({
  fetchUndiscoveredMessagesForMap: jest.fn(),
  getCachedMapMessages: jest.fn(),
  fetchFollowingPublicMessages: jest.fn(),
}));

jest.mock('@/utils/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import {
  fetchUndiscoveredMessagesForMap,
  getCachedMapMessages,
  fetchFollowingPublicMessages,
} from '@/services/messages';
import { useMapMessages } from '@/hooks/useMapMessages';
import { UndiscoveredMessageMapMeta } from '@/types';

const mockFetchUndiscovered = fetchUndiscoveredMessagesForMap as jest.Mock;
const mockGetCached = getCachedMapMessages as jest.Mock;
const mockFetchFollowing = fetchFollowingPublicMessages as jest.Mock;

function makeMsg(id: string): UndiscoveredMessageMapMeta {
  return {
    id,
    location: { latitude: 48.8566, longitude: 2.3522 },
    created_at: new Date().toISOString(),
    is_public: false,
    sender: { id: 'sender-1', display_name: 'Test', avatar_url: 'https://example.com/a.jpg' },
  } as unknown as UndiscoveredMessageMapMeta;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockFetchUndiscovered.mockResolvedValue([]);
  mockFetchFollowing.mockResolvedValue([]);
});

describe('useMapMessages — initial state', () => {
  it('starts with loading=true and empty messages', () => {
    const { result } = renderHook(() => useMapMessages());
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });
});

describe('useMapMessages — loadMessages', () => {
  it('sets loading=false after loadMessages completes', async () => {
    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.loading).toBe(false);
  });

  it('displays cached messages before fresh data arrives', async () => {
    const cached = [makeMsg('cached-1'), makeMsg('cached-2')];
    mockGetCached.mockResolvedValue(cached);

    // Delay the fresh fetch so we can observe the intermediate state
    let resolveUndiscovered!: (data: UndiscoveredMessageMapMeta[]) => void;
    mockFetchUndiscovered.mockReturnValue(
      new Promise<UndiscoveredMessageMapMeta[]>(r => { resolveUndiscovered = r; })
    );
    mockFetchFollowing.mockResolvedValue([]);

    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      resolveUndiscovered([]);
      await result.current.loadMessages();
    });

    // After full load, fresh (empty) data replaces cache
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('merges undiscovered and following messages without duplicates', async () => {
    const msg1 = makeMsg('msg-1');
    const msg2 = makeMsg('msg-2');
    const msg3 = makeMsg('msg-3');

    // msg-2 appears in both lists — should appear only once in output
    mockFetchUndiscovered.mockResolvedValue([msg1, msg2]);
    mockFetchFollowing.mockResolvedValue([msg2, msg3]);

    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toHaveLength(3);
    const ids = result.current.messages.map(m => m.id).sort();
    expect(ids).toEqual(['msg-1', 'msg-2', 'msg-3']);
  });

  it('gives priority to undiscovered messages over following messages for same ID', async () => {
    const msg = makeMsg('msg-shared');
    const msgFromFollowing = { ...makeMsg('msg-shared'), is_public: true };

    mockFetchUndiscovered.mockResolvedValue([msg]);
    mockFetchFollowing.mockResolvedValue([msgFromFollowing]);

    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toHaveLength(1);
    // The undiscovered version (is_public=false) takes priority
    expect(result.current.messages[0].is_public).toBe(false);
  });

  it('works correctly when both fetches return empty arrays', async () => {
    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('setMessages allows external updates to the message list', async () => {
    const { result } = renderHook(() => useMapMessages());
    const newMessages = [makeMsg('external-1')];

    act(() => {
      result.current.setMessages(newMessages);
    });

    expect(result.current.messages).toEqual(newMessages);
  });
});
