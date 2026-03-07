import { blockUser, unblockUser, isBlocked, fetchBlockedIds } from '@/services/blocks';

// ─── Mock setup ──────────────────────────────────────────────────────────────
// Jest 30 no longer co-hoists `const mock* = jest.fn()` with jest.mock() factories.
// Instead, we define mocks inside the factory and access them via jest.requireMock().

jest.mock('@/services/supabase', () => {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'eq', 'delete', 'insert', 'maybeSingle'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  const mockFrom = jest.fn().mockReturnValue(chain);
  return {
    supabase: { from: mockFrom },
    getCachedUserId: jest.fn(),
    // Exposed for test access:
    __chain: chain,
    __mockFrom: mockFrom,
  };
});

jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

jest.mock('@/services/subscriptions', () => ({
  unfollow: jest.fn().mockResolvedValue(true),
}));

import { getCachedUserId } from '@/services/supabase';

const CURRENT_USER = 'current-user-id';
const OTHER_USER = 'other-user-id';

type SupabaseMock = {
  supabase: { from: jest.Mock };
  getCachedUserId: jest.Mock;
  __chain: Record<string, jest.Mock>;
  __mockFrom: jest.Mock;
};

type SubscriptionsMock = { unfollow: jest.Mock };

function getSupabaseMock(): SupabaseMock {
  return jest.requireMock('@/services/supabase') as SupabaseMock;
}

function getChain(): Record<string, jest.Mock> {
  return getSupabaseMock().__chain;
}

function getUnfollow(): jest.Mock {
  return (jest.requireMock('@/services/subscriptions') as SubscriptionsMock).unfollow;
}

beforeEach(() => {
  jest.clearAllMocks();

  // Reset chain methods
  const chain = getChain();
  ['select', 'eq', 'delete', 'insert', 'maybeSingle'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });

  // Reset from
  getSupabaseMock().__mockFrom.mockReturnValue(chain);

  // Reset getCachedUserId
  (getCachedUserId as jest.Mock).mockReturnValue(CURRENT_USER);

  // Reset unfollow
  getUnfollow().mockResolvedValue(true);
});

// ─── blockUser ───────────────────────────────────────────────────────────────

describe('blockUser', () => {
  it('returns false when no current user', async () => {
    (getCachedUserId as jest.Mock).mockReturnValue(null);
    expect(await blockUser(OTHER_USER)).toBe(false);
    expect(getSupabaseMock().__mockFrom).not.toHaveBeenCalled();
  });

  it('returns true and removes follow relationships on success', async () => {
    const chain = getChain();
    chain.insert = jest.fn().mockResolvedValue({ error: null });

    const eqFinal = jest.fn().mockResolvedValue({ error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    chain.delete = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await blockUser(OTHER_USER)).toBe(true);
    expect(chain.insert).toHaveBeenCalledWith({ blocker_id: CURRENT_USER, blocked_id: OTHER_USER });
    expect(getUnfollow()).toHaveBeenCalledWith(OTHER_USER);
  });

  it('returns false on supabase insert error', async () => {
    const chain = getChain();
    chain.insert = jest.fn().mockResolvedValue({ error: { message: 'Unique violation' } });
    expect(await blockUser(OTHER_USER)).toBe(false);
    expect(getUnfollow()).not.toHaveBeenCalled();
  });
});

// ─── unblockUser ─────────────────────────────────────────────────────────────

describe('unblockUser', () => {
  it('returns false when no current user', async () => {
    (getCachedUserId as jest.Mock).mockReturnValue(null);
    expect(await unblockUser(OTHER_USER)).toBe(false);
  });

  it('returns true on successful unblock', async () => {
    const chain = getChain();
    const eqFinal = jest.fn().mockResolvedValue({ error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    chain.delete = jest.fn().mockReturnValue({ eq: eqFirst });
    expect(await unblockUser(OTHER_USER)).toBe(true);
  });

  it('returns false on supabase error', async () => {
    const chain = getChain();
    const eqFinal = jest.fn().mockResolvedValue({ error: { message: 'Not found' } });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    chain.delete = jest.fn().mockReturnValue({ eq: eqFirst });
    expect(await unblockUser(OTHER_USER)).toBe(false);
  });
});

// ─── isBlocked ───────────────────────────────────────────────────────────────

describe('isBlocked', () => {
  it('returns false when no current user', async () => {
    (getCachedUserId as jest.Mock).mockReturnValue(null);
    expect(await isBlocked(OTHER_USER)).toBe(false);
  });

  it('returns true when block row exists', async () => {
    const chain = getChain();
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'block-1' }, error: null });
    expect(await isBlocked(OTHER_USER)).toBe(true);
  });

  it('returns false when no block row exists', async () => {
    const chain = getChain();
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    expect(await isBlocked(OTHER_USER)).toBe(false);
  });

  it('returns false on supabase error', async () => {
    const chain = getChain();
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    expect(await isBlocked(OTHER_USER)).toBe(false);
  });
});

// ─── fetchBlockedIds ─────────────────────────────────────────────────────────

describe('fetchBlockedIds', () => {
  it('returns empty array when no current user', async () => {
    (getCachedUserId as jest.Mock).mockReturnValue(null);
    expect(await fetchBlockedIds()).toEqual([]);
  });

  it('returns list of blocked user IDs', async () => {
    const chain = getChain();
    const eqResult = jest.fn().mockResolvedValue({
      data: [{ blocked_id: 'user-a' }, { blocked_id: 'user-b' }],
      error: null,
    });
    chain.select = jest.fn().mockReturnValue({ eq: eqResult });
    expect(await fetchBlockedIds()).toEqual(['user-a', 'user-b']);
  });

  it('returns empty array on error', async () => {
    const chain = getChain();
    const eqResult = jest.fn().mockResolvedValue({ data: null, error: { message: 'error' } });
    chain.select = jest.fn().mockReturnValue({ eq: eqResult });
    expect(await fetchBlockedIds()).toEqual([]);
  });
});
