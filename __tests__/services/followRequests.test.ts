import {
  fetchSentRequestStatus,
  fetchReceivedRequests,
  fetchReceivedRequestsCount,
  sendFollowRequest,
  cancelFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  FollowRequest,
} from '@/services/followRequests';

// --- Supabase mock setup ---

const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();

function buildChain() {
  const chain: Record<string, jest.Mock> = {};
  ['select', 'eq', 'insert', 'delete', 'update', 'order'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.maybeSingle = mockMaybeSingle;
  chain.single = mockSingle;
  return chain;
}

let queryChain: ReturnType<typeof buildChain>;

jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
  getCachedUserId: jest.fn(),
}));
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));
jest.mock('@/services/subscriptions', () => ({ follow: jest.fn() }));

import { supabase, getCachedUserId } from '@/services/supabase';
import { follow } from '@/services/subscriptions';

const mockFrom = supabase.from as jest.Mock;
const mockGetCachedUserId = getCachedUserId as jest.Mock;
const mockFollow = follow as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  queryChain = buildChain();
  mockFrom.mockReturnValue(queryChain);
  mockGetCachedUserId.mockReturnValue('current-user-id');
});

// ─── fetchSentRequestStatus ──────────────────────────────────────────────────

describe('fetchSentRequestStatus', () => {
  it('returns null when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchSentRequestStatus('target-id')).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns { id, status } when a pending request exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'req-1', status: 'pending' },
      error: null,
    });
    const result = await fetchSentRequestStatus('target-id');
    expect(result).toEqual({ id: 'req-1', status: 'pending' });
  });

  it('returns null when no request exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchSentRequestStatus('target-id')).toBeNull();
  });

  it('returns null on supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    expect(await fetchSentRequestStatus('target-id')).toBeNull();
  });
});

// ─── fetchReceivedRequests ───────────────────────────────────────────────────

describe('fetchReceivedRequests', () => {
  it('returns [] when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchReceivedRequests()).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns the list of pending received requests', async () => {
    const fakeRequests: Partial<FollowRequest>[] = [
      { id: 'req-1', requester_id: 'user-a', target_id: 'current-user-id', status: 'pending', created_at: '' },
    ];
    queryChain.order = jest.fn().mockResolvedValue({ data: fakeRequests, error: null });

    const result = await fetchReceivedRequests();
    expect(result).toEqual(fakeRequests);
  });

  it('returns [] on supabase error', async () => {
    queryChain.order = jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } });
    expect(await fetchReceivedRequests()).toEqual([]);
  });
});

// ─── fetchReceivedRequestsCount ──────────────────────────────────────────────

describe('fetchReceivedRequestsCount', () => {
  it('returns 0 when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await fetchReceivedRequestsCount()).toBe(0);
  });

  it('returns the count of pending requests', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ count: 5, error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await fetchReceivedRequestsCount()).toBe(5);
  });

  it('returns 0 on supabase error', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ count: null, error: { message: 'err' } });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await fetchReceivedRequestsCount()).toBe(0);
  });

  it('returns 0 when count is null without error', async () => {
    const eqFinal = jest.fn().mockResolvedValue({ count: null, error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqFinal });
    queryChain.select = jest.fn().mockReturnValue({ eq: eqFirst });

    expect(await fetchReceivedRequestsCount()).toBe(0);
  });
});

// ─── sendFollowRequest ───────────────────────────────────────────────────────

describe('sendFollowRequest', () => {
  it('returns null when no current user', async () => {
    mockGetCachedUserId.mockReturnValue(null);
    expect(await sendFollowRequest('target-id')).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns the new request id on success', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-req-id' }, error: null });
    const result = await sendFollowRequest('target-id');
    expect(result).toBe('new-req-id');
  });

  it('inserts correct requester_id and target_id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'req-x' }, error: null });
    await sendFollowRequest('target-id');
    expect(queryChain.insert).toHaveBeenCalledWith({
      requester_id: 'current-user-id',
      target_id: 'target-id',
    });
  });

  it('returns null on supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Conflict' } });
    expect(await sendFollowRequest('target-id')).toBeNull();
  });
});

// ─── cancelFollowRequest ─────────────────────────────────────────────────────

describe('cancelFollowRequest', () => {
  it('returns true on success', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.delete = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await cancelFollowRequest('req-1')).toBe(true);
    expect(eqResult).toHaveBeenCalledWith('id', 'req-1');
  });

  it('returns false on supabase error', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: { message: 'Not found' } });
    queryChain.delete = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await cancelFollowRequest('req-1')).toBe(false);
  });
});

// ─── acceptFollowRequest ─────────────────────────────────────────────────────

const fakeRequest: FollowRequest = {
  id: 'req-1',
  requester_id: 'user-a',
  target_id: 'current-user-id',
  status: 'pending',
  created_at: '',
};

describe('acceptFollowRequest', () => {
  it('returns false when follow() fails', async () => {
    mockFollow.mockResolvedValue(false);
    expect(await acceptFollowRequest(fakeRequest)).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns false when follow() succeeds but update fails', async () => {
    mockFollow.mockResolvedValue(true);
    const eqResult = jest.fn().mockResolvedValue({ error: { message: 'err' } });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await acceptFollowRequest(fakeRequest)).toBe(false);
  });

  it('returns true on full success', async () => {
    mockFollow.mockResolvedValue(true);
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await acceptFollowRequest(fakeRequest)).toBe(true);
  });

  it('calls follow() with the requester_id', async () => {
    mockFollow.mockResolvedValue(true);
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    await acceptFollowRequest(fakeRequest);
    expect(mockFollow).toHaveBeenCalledWith('user-a');
  });

  it('marks request as accepted via update', async () => {
    mockFollow.mockResolvedValue(true);
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    await acceptFollowRequest(fakeRequest);
    expect(queryChain.update).toHaveBeenCalledWith({ status: 'accepted' });
    expect(eqResult).toHaveBeenCalledWith('id', 'req-1');
  });
});

// ─── rejectFollowRequest ─────────────────────────────────────────────────────

describe('rejectFollowRequest', () => {
  it('returns true on success', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await rejectFollowRequest('req-1')).toBe(true);
  });

  it('marks request as rejected via update', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    await rejectFollowRequest('req-1');
    expect(queryChain.update).toHaveBeenCalledWith({ status: 'rejected' });
    expect(eqResult).toHaveBeenCalledWith('id', 'req-1');
  });

  it('returns false on supabase error', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: { message: 'err' } });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await rejectFollowRequest('req-1')).toBe(false);
  });
});
