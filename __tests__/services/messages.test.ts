/**
 * Tests for messages.ts
 *
 * We focus on:
 * 1. Functions that return early when no user ID
 * 2. The buildConversations logic (via fetchConversations)
 * 3. markMessageAsRead cache invalidation
 * 4. sendMessage payload construction
 * 5. FLAG_BOT_ID constant
 */

import { FLAG_BOT_ID } from '@/services/messages';

// ─── Supabase query chain mock ───────────────────────────────────────────────
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

function makeChain(resolveWith: any) {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'or', 'order', 'gt', 'not', 'upsert', 'update', 'insert'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue(resolveWith);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith);
  // Make the chain itself awaitable (for .select().eq()...)
  chain.then = (resolve: any) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
  getCachedUserId: jest.fn(),
}));

jest.mock('@/services/cache', () => ({
  getCachedData: jest.fn().mockResolvedValue(null),
  setCachedData: jest.fn().mockResolvedValue(undefined),
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  setLastSyncTimestamp: jest.fn().mockResolvedValue(undefined),
  CACHE_KEYS: {
    CONVERSATIONS_MESSAGES: 'conversations_messages',
    MAP_MESSAGES: 'map_messages',
    CONVERSATION: (id: string) => `conversation_${id}`,
    USERS: 'users',
  },
}));

jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

import { getCachedUserId } from '@/services/supabase';
import {
  getCachedData,
  setCachedData,
  getLastSyncTimestamp,
  CACHE_KEYS,
} from '@/services/cache';

import {
  fetchConversations,
  fetchConversationMessages,
  fetchMyMessages,
  fetchUnreadMessages,
  sendMessage,
  markMessageAsRead,
  fetchFollowedUsers,
  getCachedConversations,
  getCachedConversationMessages,
  getCachedMapMessages,
  markPublicMessageDiscovered,
  fetchDiscoveredPublicMessageIds,
} from '@/services/messages';

const mockGetCachedUserId = getCachedUserId as jest.Mock;
const mockGetCachedData = getCachedData as jest.Mock;
const mockSetCachedData = setCachedData as jest.Mock;
const mockGetLastSyncTimestamp = getLastSyncTimestamp as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedUserId.mockReturnValue('user-current');
  mockGetCachedData.mockResolvedValue(null);
  mockGetLastSyncTimestamp.mockResolvedValue(null);
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('FLAG_BOT_ID', () => {
  it('is the expected bot UUID', () => {
    expect(FLAG_BOT_ID).toBe('00000000-0000-0000-0000-000000000001');
  });
});

// ─── fetchConversations ──────────────────────────────────────────────────────

describe('fetchConversations', () => {
  it('returns empty array when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    const result = await fetchConversations();
    expect(result).toEqual([]);
  });

  it('returns conversations built from fetched messages', async () => {
    const now = new Date().toISOString();
    const messages = [
      {
        id: 'msg-1',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'hello',
        created_at: now,
        is_read: false,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];

    const chain = makeChain({ data: messages, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchConversations();
    expect(result).toHaveLength(1);
    expect(result[0].otherUser.id).toBe('user-a');
    expect(result[0].unreadCount).toBe(1);
    expect(result[0].lastMessage.is_from_me).toBe(false);
  });

  it('uses cache when supabase returns an error', async () => {
    const cachedMessages = [
      {
        id: 'cached-msg',
        sender_id: 'user-b',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'cached',
        created_at: new Date().toISOString(),
        is_read: true,
        sender: { id: 'user-b', display_name: 'Bob', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];
    mockGetCachedData.mockResolvedValue(cachedMessages);

    const chain = makeChain({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchConversations();
    expect(result).toHaveLength(1);
    expect(result[0].otherUser.id).toBe('user-b');
  });

  it('merges new messages with cached messages by ID', async () => {
    const old = new Date(Date.now() - 60_000).toISOString();
    const now = new Date().toISOString();

    const cachedMessages = [
      {
        id: 'msg-1',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'old text',
        created_at: old,
        is_read: false,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];
    mockGetCachedData.mockResolvedValue(cachedMessages);

    // New message with same ID (updated)
    const newMessages = [
      {
        id: 'msg-1',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'updated text',
        created_at: now,
        is_read: true,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];

    const chain = makeChain({ data: newMessages, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchConversations();
    // Should have only 1 conversation (same user), with the updated message
    expect(result).toHaveLength(1);
    // Merged data should be cached
    expect(mockSetCachedData).toHaveBeenCalled();
  });

  it('correctly separates unread count per sender', async () => {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 1000).toISOString();

    const messages = [
      {
        id: 'msg-1',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'hi',
        created_at: now,
        is_read: false,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
      {
        id: 'msg-2',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'hello again',
        created_at: earlier,
        is_read: false,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];

    const chain = makeChain({ data: messages, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchConversations();
    expect(result).toHaveLength(1);
    expect(result[0].unreadCount).toBe(2);
  });
});

// ─── getCachedConversations ──────────────────────────────────────────────────

describe('getCachedConversations', () => {
  it('returns null when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await getCachedConversations()).toBeNull();
  });

  it('returns null when cache is empty', async () => {
    mockGetCachedData.mockResolvedValue(null);
    expect(await getCachedConversations()).toBeNull();
  });

  it('returns conversations from cache', async () => {
    const cached = [
      {
        id: 'msg-1',
        sender_id: 'user-a',
        recipient_id: 'user-current',
        content_type: 'text',
        text_content: 'cached',
        created_at: new Date().toISOString(),
        is_read: false,
        sender: { id: 'user-a', display_name: 'Alice', avatar_url: null },
        recipient: { id: 'user-current', display_name: 'Me', avatar_url: null },
      },
    ];
    mockGetCachedData.mockResolvedValue(cached);
    const result = await getCachedConversations();
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
  });
});

// ─── getCachedConversationMessages ───────────────────────────────────────────

describe('getCachedConversationMessages', () => {
  it('returns null when no cached data', async () => {
    mockGetCachedData.mockResolvedValue(null);
    expect(await getCachedConversationMessages('other-user')).toBeNull();
  });

  it('returns cached messages', async () => {
    const cached = [{ id: 'msg-1', text_content: 'hello' }];
    mockGetCachedData.mockResolvedValue(cached);
    const result = await getCachedConversationMessages('other-user');
    expect(result).toEqual(cached);
  });
});

// ─── getCachedMapMessages ─────────────────────────────────────────────────────

describe('getCachedMapMessages', () => {
  it('returns null when cache is empty', async () => {
    mockGetCachedData.mockResolvedValue(null);
    expect(await getCachedMapMessages()).toBeNull();
  });

  it('returns cached map messages', async () => {
    const cached = [{ id: 'msg-1', location: 'POINT(2.35 48.85)' }];
    mockGetCachedData.mockResolvedValue(cached);
    expect(await getCachedMapMessages()).toEqual(cached);
  });
});

// ─── fetchMyMessages ─────────────────────────────────────────────────────────

describe('fetchMyMessages', () => {
  it('returns empty array when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchMyMessages()).toEqual([]);
  });

  it('returns messages from supabase', async () => {
    const msgs = [{ id: 'msg-1', text_content: 'hello' }];
    const chain = makeChain({ data: msgs, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchMyMessages();
    expect(result).toEqual(msgs);
  });

  it('returns empty array on error', async () => {
    const chain = makeChain({ data: null, error: { message: 'err' } });
    mockFrom.mockReturnValue(chain);
    expect(await fetchMyMessages()).toEqual([]);
  });
});

// ─── fetchUnreadMessages ─────────────────────────────────────────────────────

describe('fetchUnreadMessages', () => {
  it('returns empty array when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchUnreadMessages()).toEqual([]);
  });

  it('returns unread messages from supabase', async () => {
    const msgs = [{ id: 'msg-2', is_read: false }];
    const chain = makeChain({ data: msgs, error: null });
    mockFrom.mockReturnValue(chain);
    expect(await fetchUnreadMessages()).toEqual(msgs);
  });
});

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('returns null when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    const result = await sendMessage('recipient', 'text', null, 'hello');
    expect(result).toBeNull();
  });

  it('inserts message with location as WKT POINT string', async () => {
    const insertSingleChain = { single: jest.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null }) };
    const selectChain = { select: jest.fn().mockReturnValue(insertSingleChain) };
    const insertChain = { insert: jest.fn().mockReturnValue(selectChain) };
    mockFrom.mockReturnValue(insertChain);

    const result = await sendMessage(
      'recipient-id',
      'text',
      { latitude: 48.8566, longitude: 2.3522 },
      'Hello world'
    );

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_id: 'user-current',
        recipient_id: 'recipient-id',
        content_type: 'text',
        text_content: 'Hello world',
        location: 'POINT(2.3522 48.8566)',
        is_read: false,
      })
    );
    expect(result).toEqual({ id: 'new-msg' });
  });

  it('sets is_read true when no location provided', async () => {
    const insertSingleChain = { single: jest.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null }) };
    const selectChain = { select: jest.fn().mockReturnValue(insertSingleChain) };
    const insertChain = { insert: jest.fn().mockReturnValue(selectChain) };
    mockFrom.mockReturnValue(insertChain);

    await sendMessage('recipient-id', 'text', null, 'No location message');

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        location: null,
        is_read: true,
      })
    );
  });

  it('returns null on supabase error', async () => {
    const insertSingleChain = { single: jest.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } }) };
    const selectChain = { select: jest.fn().mockReturnValue(insertSingleChain) };
    const insertChain = { insert: jest.fn().mockReturnValue(selectChain) };
    mockFrom.mockReturnValue(insertChain);

    const result = await sendMessage('recipient-id', 'text', null, 'test');
    expect(result).toBeNull();
  });

  it('sets is_public flag correctly', async () => {
    const insertSingleChain = { single: jest.fn().mockResolvedValue({ data: { id: 'pub-msg' }, error: null }) };
    const selectChain = { select: jest.fn().mockReturnValue(insertSingleChain) };
    const insertChain = { insert: jest.fn().mockReturnValue(selectChain) };
    mockFrom.mockReturnValue(insertChain);

    await sendMessage('recipient-id', 'text', null, 'public message', undefined, true);

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: true })
    );
  });
});

// ─── markMessageAsRead ────────────────────────────────────────────────────────

describe('markMessageAsRead', () => {
  it('returns false on supabase error', async () => {
    const eqChain = { eq: jest.fn().mockResolvedValue({ error: { message: 'err' } }) };
    const updateChain = { update: jest.fn().mockReturnValue(eqChain) };
    mockFrom.mockReturnValue(updateChain);

    expect(await markMessageAsRead('msg-1')).toBe(false);
  });

  it('returns true and removes message from map cache', async () => {
    const eqChain = { eq: jest.fn().mockResolvedValue({ error: null }) };
    const updateChain = { update: jest.fn().mockReturnValue(eqChain) };
    mockFrom.mockReturnValue(updateChain);

    const mapCache = [{ id: 'msg-1', location: 'POINT(0 0)' }, { id: 'msg-2', location: 'POINT(1 1)' }];
    const convCache = [{ id: 'msg-1', is_read: false }, { id: 'msg-3', is_read: false }];

    mockGetCachedData
      .mockResolvedValueOnce(mapCache)   // MAP_MESSAGES cache
      .mockResolvedValueOnce(convCache); // CONVERSATIONS_MESSAGES cache

    const result = await markMessageAsRead('msg-1');
    expect(result).toBe(true);

    // Map cache updated to remove msg-1
    expect(mockSetCachedData).toHaveBeenCalledWith(
      CACHE_KEYS.MAP_MESSAGES,
      [{ id: 'msg-2', location: 'POINT(1 1)' }]
    );

    // Conversations cache updated with is_read: true
    expect(mockSetCachedData).toHaveBeenCalledWith(
      CACHE_KEYS.CONVERSATIONS_MESSAGES,
      expect.arrayContaining([expect.objectContaining({ id: 'msg-1', is_read: true })])
    );
  });

  it('updates per-conversation cache when senderId is provided', async () => {
    const eqChain = { eq: jest.fn().mockResolvedValue({ error: null }) };
    const updateChain = { update: jest.fn().mockReturnValue(eqChain) };
    mockFrom.mockReturnValue(updateChain);

    const perConvCache = [
      { id: 'msg-1', is_read: false, sender_id: 'user-a' },
      { id: 'msg-5', is_read: false, sender_id: 'user-a' },
    ];

    mockGetCachedData
      .mockResolvedValueOnce(null)   // MAP_MESSAGES
      .mockResolvedValueOnce(null)   // CONVERSATIONS_MESSAGES
      .mockResolvedValueOnce(perConvCache); // per-conversation cache

    await markMessageAsRead('msg-1', 'user-a');

    expect(mockSetCachedData).toHaveBeenCalledWith(
      CACHE_KEYS.CONVERSATION('user-a'),
      expect.arrayContaining([expect.objectContaining({ id: 'msg-1', is_read: true })])
    );
  });
});

// ─── fetchFollowedUsers ───────────────────────────────────────────────────────

describe('fetchFollowedUsers', () => {
  it('returns empty array when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchFollowedUsers()).toEqual([]);
  });

  it('returns empty when not following anyone', async () => {
    const chain1 = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain1);
    expect(await fetchFollowedUsers()).toEqual([]);
  });

  it('returns list of followed users', async () => {
    // First call: subscriptions
    const subsChain = makeChain({ data: [{ following_id: 'user-a' }], error: null });
    // Second call: users
    const usersData = [{ id: 'user-a', display_name: 'Alice', avatar_url: null }];
    const usersChain = makeChain({ data: usersData, error: null });

    mockFrom
      .mockReturnValueOnce(subsChain)
      .mockReturnValueOnce(usersChain);

    const result = await fetchFollowedUsers();
    expect(result).toEqual(usersData);
  });
});

// ─── markPublicMessageDiscovered ─────────────────────────────────────────────

describe('markPublicMessageDiscovered', () => {
  it('returns false when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await markPublicMessageDiscovered('msg-1')).toBe(false);
  });

  it('returns true on success', async () => {
    const upsertChain = { upsert: jest.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(upsertChain);
    expect(await markPublicMessageDiscovered('msg-1')).toBe(true);
  });

  it('returns false on error', async () => {
    const upsertChain = { upsert: jest.fn().mockResolvedValue({ error: { message: 'err' } }) };
    mockFrom.mockReturnValue(upsertChain);
    expect(await markPublicMessageDiscovered('msg-1')).toBe(false);
  });
});

// ─── fetchDiscoveredPublicMessageIds ─────────────────────────────────────────

describe('fetchDiscoveredPublicMessageIds', () => {
  it('returns empty set when no user ID', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    const result = await fetchDiscoveredPublicMessageIds(['msg-1']);
    expect(result.size).toBe(0);
  });

  it('returns empty set for empty input', async () => {
    const result = await fetchDiscoveredPublicMessageIds([]);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns set of discovered message IDs', async () => {
    const chain = makeChain({
      data: [{ message_id: 'msg-1' }, { message_id: 'msg-3' }],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await fetchDiscoveredPublicMessageIds(['msg-1', 'msg-2', 'msg-3']);
    expect(result).toEqual(new Set(['msg-1', 'msg-3']));
  });

  it('returns empty set on error', async () => {
    const chain = makeChain({ data: null, error: { message: 'err' } });
    mockFrom.mockReturnValue(chain);

    const result = await fetchDiscoveredPublicMessageIds(['msg-1']);
    expect(result.size).toBe(0);
  });
});
