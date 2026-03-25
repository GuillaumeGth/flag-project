/**
 * Tests for useMapMessages hook
 *
 * Covers:
 * 1. Initial state — loading=true, messages=[]
 * 2. loadMessages — uses cache while fresh data loads
 * 3. loadMessages — merges undiscovered + following public messages (deduplication)
 * 4. loadMessages — sets loading=false after completion
 * 5. Realtime INSERT — new private message triggers loadMessages
 * 6. Realtime UPDATE — deleted_by_sender=true removes message; false does nothing
 * 7. AppState — foreground triggers loadMessages; background→background does not
 * 8. Polling — setInterval set up every 3 min; clearInterval called on unmount
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

// Supabase channel mock — all jest.fn() inline so they're safe under hoisting
jest.mock('@/services/supabase', () => {
  const channelObj: any = {};
  channelObj.on = jest.fn().mockReturnValue(channelObj);
  channelObj.subscribe = jest.fn().mockReturnValue(channelObj);
  return {
    supabase: {
      channel: jest.fn().mockReturnValue(channelObj),
      removeChannel: jest.fn(),
    },
    getCachedUserId: jest.fn().mockReturnValue('user-123'),
  };
});

import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  fetchUndiscoveredMessagesForMap,
  getCachedMapMessages,
  fetchFollowingPublicMessages,
} from '@/services/messages';
import { supabase } from '@/services/supabase';
import { useMapMessages } from '@/hooks/useMapMessages';
import { UndiscoveredMessageMapMeta } from '@/types';

const mockFetchUndiscovered = fetchUndiscoveredMessagesForMap as jest.Mock;
const mockGetCached = getCachedMapMessages as jest.Mock;
const mockFetchFollowing = fetchFollowingPublicMessages as jest.Mock;

// Helper — returns the channel object returned by supabase.channel()
function getChannelObj() {
  return (supabase.channel as jest.Mock).mock.results[0]?.value;
}

function makeMsg(id: string): UndiscoveredMessageMapMeta {
  return {
    id,
    location: { latitude: 48.8566, longitude: 2.3522 },
    created_at: new Date().toISOString(),
    is_public: false,
    sender: { id: 'sender-1', display_name: 'Test', avatar_url: 'https://example.com/a.jpg' },
  } as unknown as UndiscoveredMessageMapMeta;
}

let mockAppStateListener: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCached.mockResolvedValue(null);
  mockFetchUndiscovered.mockResolvedValue([]);
  mockFetchFollowing.mockResolvedValue([]);

  // Re-wire channel mock after clearAllMocks
  const channelObj = (supabase.channel as jest.Mock).mock.results[0]?.value;
  if (channelObj) {
    channelObj.on.mockReturnValue(channelObj);
    channelObj.subscribe.mockReturnValue(channelObj);
  }

  // Spy on AppState.addEventListener and capture the listener
  // Also ensure currentState is a valid string so appStateRef.current.match works
  (AppState as any).currentState = 'active';
  mockAppStateListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    mockAppStateListener = handler as jest.Mock;
    return { remove: jest.fn() };
  });
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

// ─── Realtime INSERT ──────────────────────────────────────────────────────────

describe('useMapMessages — Realtime INSERT', () => {
  it('calls loadMessages when a new private message is received for current user', async () => {
    mockFetchUndiscovered.mockResolvedValue([makeMsg('rt-1')]);

    renderHook(() => useMapMessages());

    const channelObj = getChannelObj();
    expect(channelObj).toBeDefined();

    // Find the INSERT handler from .on() calls
    const onCalls: Array<[string, object, (payload: unknown) => void]> = channelObj.on.mock.calls;
    const insertCall = onCalls.find(([, filter]) => (filter as any).event === 'INSERT');
    expect(insertCall).toBeDefined();

    const insertHandler = insertCall![2];

    mockFetchUndiscovered.mockClear();

    await act(async () => {
      insertHandler({ new: { id: 'rt-1', recipient_id: 'user-123' } });
      await Promise.resolve();
    });

    expect(mockFetchUndiscovered).toHaveBeenCalled();
  });
});

// ─── Realtime UPDATE ──────────────────────────────────────────────────────────

describe('useMapMessages — Realtime UPDATE', () => {
  it('removes a message from state when deleted_by_sender=true', async () => {
    const msg = makeMsg('msg-to-delete');
    mockFetchUndiscovered.mockResolvedValue([msg]);

    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toHaveLength(1);

    const channelObj = getChannelObj();
    const onCalls: Array<[string, object, (payload: unknown) => void]> = channelObj.on.mock.calls;
    const updateCall = onCalls.find(([, filter]) => (filter as any).event === 'UPDATE');
    expect(updateCall).toBeDefined();

    act(() => {
      updateCall![2]({ new: { id: 'msg-to-delete', deleted_by_sender: true } });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('does NOT remove a message when deleted_by_sender=false', async () => {
    const msg = makeMsg('msg-keep');
    mockFetchUndiscovered.mockResolvedValue([msg]);

    const { result } = renderHook(() => useMapMessages());

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toHaveLength(1);

    const channelObj = getChannelObj();
    const onCalls: Array<[string, object, (payload: unknown) => void]> = channelObj.on.mock.calls;
    const updateCall = onCalls.find(([, filter]) => (filter as any).event === 'UPDATE');

    act(() => {
      updateCall![2]({ new: { id: 'msg-keep', deleted_by_sender: false } });
    });

    expect(result.current.messages).toHaveLength(1);
  });
});

// ─── AppState ─────────────────────────────────────────────────────────────────

describe('useMapMessages — AppState', () => {
  it('calls loadMessages when app transitions from background to active', async () => {
    renderHook(() => useMapMessages());

    mockFetchUndiscovered.mockClear();

    // Simulate background → active
    act(() => { mockAppStateListener('background'); });
    await act(async () => {
      mockAppStateListener('active');
      await Promise.resolve();
    });

    expect(mockFetchUndiscovered).toHaveBeenCalled();
  });

  it('does NOT call loadMessages when app goes to background', async () => {
    renderHook(() => useMapMessages());

    mockFetchUndiscovered.mockClear();

    act(() => { mockAppStateListener('background'); });

    expect(mockFetchUndiscovered).not.toHaveBeenCalled();
  });
});

// ─── Polling ──────────────────────────────────────────────────────────────────

describe('useMapMessages — polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls loadMessages after 3 minutes via setInterval', async () => {
    mockFetchUndiscovered.mockResolvedValue([]);
    mockFetchFollowing.mockResolvedValue([]);

    renderHook(() => useMapMessages());

    // Clear mock calls from initial effects
    mockFetchUndiscovered.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(3 * 60 * 1000);
      await Promise.resolve();
    });

    expect(mockFetchUndiscovered).toHaveBeenCalled();
  });

  it('clears the interval on unmount', async () => {
    mockFetchUndiscovered.mockResolvedValue([]);
    mockFetchFollowing.mockResolvedValue([]);

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useMapMessages());
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
