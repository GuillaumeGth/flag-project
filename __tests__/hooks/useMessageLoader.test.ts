/**
 * Tests for useMessageLoader hook
 *
 * Covers:
 * 1. Initial state — loading=true, messages=[]
 * 2. loadMessages — shows cached messages, then replaces with fresh data
 * 3. loadMessages — works without cache (null)
 * 4. Realtime subscription — subscribes on mount, unsubscribes on unmount
 * 5. Realtime — calls loadMessages when a new message arrives from the right sender
 * 6. Realtime — ignores messages from other senders
 * 7. No subscription when user is not logged in
 */

const mockChannel = {
  on: jest.fn(),
  subscribe: jest.fn(),
};
mockChannel.on.mockReturnValue(mockChannel);
mockChannel.subscribe.mockReturnValue(mockChannel);

const mockRemoveChannel = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
  getCachedUserId: jest.fn(),
}));

jest.mock('@/services/messages', () => ({
  fetchConversationMessages: jest.fn(),
  getCachedConversationMessages: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/utils/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { supabase } from '@/services/supabase';
import {
  fetchConversationMessages,
  getCachedConversationMessages,
} from '@/services/messages';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageLoader } from '@/hooks/useMessageLoader';
import { MessageWithUsers } from '@/types';

const mockFetchMessages = fetchConversationMessages as jest.Mock;
const mockGetCached = getCachedConversationMessages as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockSupabaseChannel = supabase.channel as jest.Mock;

function makeMsg(id: string): MessageWithUsers {
  return {
    id,
    sender_id: 'user-other',
    recipient_id: 'user-current',
    content_type: 'text',
    text_content: `Message ${id}`,
    created_at: new Date().toISOString(),
    is_read: false,
  } as unknown as MessageWithUsers;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'user-current' } });
  mockGetCached.mockResolvedValue(null);
  mockFetchMessages.mockResolvedValue([]);
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  mockSupabaseChannel.mockReturnValue(mockChannel);
});

describe('useMessageLoader — initial state', () => {
  it('starts with loading=true and empty messages', () => {
    const { result } = renderHook(() => useMessageLoader('other-user'));
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });
});

describe('useMessageLoader — loadMessages', () => {
  it('sets loading=false after loadMessages completes', async () => {
    const { result } = renderHook(() => useMessageLoader('other-user'));

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.loading).toBe(false);
  });

  it('loads messages from the service', async () => {
    const msgs = [makeMsg('msg-1'), makeMsg('msg-2')];
    mockFetchMessages.mockResolvedValue(msgs);

    const { result } = renderHook(() => useMessageLoader('other-user'));

    await act(async () => {
      await result.current.loadMessages();
    });

    expect(result.current.messages).toEqual(msgs);
    expect(mockFetchMessages).toHaveBeenCalledWith('other-user');
  });

  it('shows cached messages when available before fresh data', async () => {
    const cached = [makeMsg('cached-msg')];
    mockGetCached.mockResolvedValue(cached);
    mockFetchMessages.mockResolvedValue([makeMsg('fresh-msg')]);

    const { result } = renderHook(() => useMessageLoader('other-user'));

    await act(async () => {
      await result.current.loadMessages();
    });

    // Final state should be fresh data
    expect(result.current.messages).toEqual([makeMsg('fresh-msg')]);
  });

  it('does not use cache when messages are already loaded', async () => {
    const msgs = [makeMsg('msg-1')];
    mockFetchMessages.mockResolvedValue(msgs);

    const { result } = renderHook(() => useMessageLoader('other-user'));

    // First load — messages array is empty, cache will be checked
    await act(async () => {
      await result.current.loadMessages();
    });

    const cachedCallCount = mockGetCached.mock.calls.length;

    // Second load — messages already set, cache should not be re-checked
    await act(async () => {
      await result.current.loadMessages();
    });

    expect(mockGetCached.mock.calls.length).toBe(cachedCallCount);
  });
});

describe('useMessageLoader — realtime subscription', () => {
  it('subscribes to the conversation channel on mount', () => {
    renderHook(() => useMessageLoader('other-user'));

    expect(mockSupabaseChannel).toHaveBeenCalledWith(
      'conversation:user-current:other-user'
    );
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useMessageLoader('other-user'));
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('does not subscribe when user is not logged in', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => useMessageLoader('other-user'));
    expect(mockSupabaseChannel).not.toHaveBeenCalled();
  });

  it('reloads messages when a new message arrives from the correct sender', async () => {
    const msgs = [makeMsg('msg-1')];
    mockFetchMessages.mockResolvedValue(msgs);

    let capturedCallback: ((payload: any) => void) | undefined;
    mockChannel.on.mockImplementation((_event, _filter, callback) => {
      capturedCallback = callback;
      return mockChannel;
    });

    const { result } = renderHook(() => useMessageLoader('other-user'));

    await act(async () => {
      await result.current.loadMessages();
    });

    const callsBefore = mockFetchMessages.mock.calls.length;

    // Simulate a new message from the correct sender via realtime
    await act(async () => {
      capturedCallback?.({ new: { sender_id: 'other-user' } });
      // Wait for the triggered loadMessages to complete
      await Promise.resolve();
    });

    expect(mockFetchMessages.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('does not reload when a message arrives from a different sender', async () => {
    let capturedCallback: ((payload: any) => void) | undefined;
    mockChannel.on.mockImplementation((_event, _filter, callback) => {
      capturedCallback = callback;
      return mockChannel;
    });

    const { result } = renderHook(() => useMessageLoader('other-user'));

    await act(async () => {
      await result.current.loadMessages();
    });

    const callsBefore = mockFetchMessages.mock.calls.length;

    act(() => {
      capturedCallback?.({ new: { sender_id: 'someone-else' } });
    });

    expect(mockFetchMessages.mock.calls.length).toBe(callsBefore);
  });
});
