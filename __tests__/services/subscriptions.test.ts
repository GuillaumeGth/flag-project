import {
  follow,
  unfollow,
  isFollowing,
  isEitherFollowing,
  fetchFollowingIds,
  fetchFollowerCount,
  fetchNotificationPrefs,
  updateNotificationPrefs,
} from '@/services/subscriptions';

// --- Supabase mock setup ---
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();

// Chain builder — each method returns `this`-like object
function buildChain() {
  const chain: Record<string, jest.Mock> = {};
  const chainMethods = ['select', 'eq', 'in', 'delete', 'update', 'upsert'];
  chainMethods.forEach(method => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.maybeSingle = mockMaybeSingle;
  chain.single = mockSingle;
  chain.insert = mockInsert;
  return chain;
}

let queryChain: ReturnType<typeof buildChain>;

jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUserId: jest.fn(),
}));
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

import { supabase, getCachedUserId } from '@/services/supabase';
const mockFrom = supabase.from as jest.Mock;
const mockGetCachedUserId = getCachedUserId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  queryChain = buildChain();
  mockFrom.mockReturnValue(queryChain);
  mockGetCachedUserId.mockReturnValue('current-user-id');
});

// ─── follow ─────────────────────────────────────────────────────────────────

describe('follow', () => {
  it('returns false when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await follow('other-user')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns true on successful follow', async () => {
    mockInsert.mockResolvedValue({ error: null });
    expect(await follow('other-user')).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      follower_id: 'current-user-id',
      following_id: 'other-user',
    });
  });

  it('returns false on supabase error', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'Duplicate key' } });
    expect(await follow('other-user')).toBe(false);
  });
});

// ─── unfollow ────────────────────────────────────────────────────────────────

describe('unfollow', () => {
  it('returns false when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await unfollow('other-user')).toBe(false);
  });

  it('returns true on successful unfollow', async () => {
    const deleteChain = { eq: jest.fn() };
    deleteChain.eq.mockReturnValueOnce({ eq: jest.fn().mockResolvedValue({ error: null }) });
    queryChain.delete = jest.fn().mockReturnValue(deleteChain);

    // Rebuild a simple chain that resolves at the end of .eq().eq()
    const eqFinal = jest.fn().mockResolvedValue({ error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.delete = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await unfollow('other-user')).toBe(true);
  });

  it('returns false on supabase error', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ error: { message: 'Not found' } });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.delete = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await unfollow('other-user')).toBe(false);
  });
});

// ─── isFollowing ─────────────────────────────────────────────────────────────

describe('isFollowing', () => {
  it('returns false when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await isFollowing('other')).toBe(false);
  });

  it('returns true when subscription row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'sub-1' }, error: null });
    expect(await isFollowing('other-user')).toBe(true);
  });

  it('returns false when subscription row does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await isFollowing('other-user')).toBe(false);
  });

  it('returns false on error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    expect(await isFollowing('other-user')).toBe(false);
  });
});

// ─── isEitherFollowing ────────────────────────────────────────────────────────

describe('isEitherFollowing', () => {
  it('returns false when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await isEitherFollowing('other')).toBe(false);
  });

  it('returns true when current user follows the other', async () => {
    // First maybeSingle (forward check) returns a row
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'sub-1' }, error: null });
    expect(await isEitherFollowing('other-user')).toBe(true);
  });

  it('returns true when the other follows current user', async () => {
    // First call (forward) returns null, second call (reverse) returns row
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'sub-2' }, error: null });
    expect(await isEitherFollowing('other-user')).toBe(true);
  });

  it('returns false when neither follows the other', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect(await isEitherFollowing('other-user')).toBe(false);
  });
});

// ─── fetchFollowingIds ───────────────────────────────────────────────────────

describe('fetchFollowingIds', () => {
  it('returns empty array when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchFollowingIds()).toEqual([]);
  });

  it('returns list of following IDs', async () => {
    const eqResult = jest.fn().mockResolvedValue({
      data: [{ following_id: 'user-a' }, { following_id: 'user-b' }],
      error: null,
    });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqResult });

    const result = await fetchFollowingIds();
    expect(result).toEqual(['user-a', 'user-b']);
  });

  it('returns empty array on error', async () => {
    const eqResult = jest.fn().mockResolvedValue({ data: null, error: { message: 'error' } });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await fetchFollowingIds()).toEqual([]);
  });
});

// ─── fetchFollowerCount ──────────────────────────────────────────────────────

describe('fetchFollowerCount', () => {
  it('returns 0 on error', async () => {
    const eqResult = jest.fn().mockResolvedValue({ count: null, error: { message: 'err' } });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqResult });
    expect(await fetchFollowerCount('user-1')).toBe(0);
  });

  it('returns the follower count', async () => {
    const eqResult = jest.fn().mockResolvedValue({ count: 42, error: null });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqResult });
    expect(await fetchFollowerCount('user-1')).toBe(42);
  });
});

// ─── fetchNotificationPrefs ──────────────────────────────────────────────────

describe('fetchNotificationPrefs', () => {
  it('returns defaults when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    const prefs = await fetchNotificationPrefs('other');
    expect(prefs).toEqual({ notifyPrivateFlags: true, notifyPublicFlags: false });
  });

  it('returns prefs from database', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { notify_private_flags: false, notify_public_flags: true },
      error: null,
    });
    const prefs = await fetchNotificationPrefs('other-user');
    expect(prefs).toEqual({ notifyPrivateFlags: false, notifyPublicFlags: true });
  });

  it('returns defaults when no row found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const prefs = await fetchNotificationPrefs('other-user');
    expect(prefs).toEqual({ notifyPrivateFlags: true, notifyPublicFlags: false });
  });
});

// ─── updateNotificationPrefs ─────────────────────────────────────────────────

describe('updateNotificationPrefs', () => {
  it('returns false when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await updateNotificationPrefs('other', { notifyPrivateFlags: false })).toBe(false);
  });

  it('returns true on success', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await updateNotificationPrefs('other-user', { notifyPrivateFlags: false })).toBe(true);
  });

  it('returns false on error', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ error: { message: 'err' } });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await updateNotificationPrefs('other-user', { notifyPublicFlags: true })).toBe(false);
  });
});
