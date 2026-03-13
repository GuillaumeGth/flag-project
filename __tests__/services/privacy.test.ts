import { fetchPrivacySettings, updatePrivacySetting } from '@/services/privacy';

// --- Supabase mock setup ---

const mockSingle = jest.fn();

function buildChain() {
  const chain: Record<string, jest.Mock> = {};
  ['select', 'eq', 'update'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = mockSingle;
  return chain;
}

let queryChain: ReturnType<typeof buildChain>;

jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

import { supabase } from '@/services/supabase';

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  queryChain = buildChain();
  mockFrom.mockReturnValue(queryChain);
});

// ─── fetchPrivacySettings ────────────────────────────────────────────────────

describe('fetchPrivacySettings', () => {
  it('returns settings from database', async () => {
    mockSingle.mockResolvedValue({
      data: { is_private: true, is_searchable: false },
      error: null,
    });
    const result = await fetchPrivacySettings('user-1');
    expect(result).toEqual({ is_private: true, is_searchable: false });
  });

  it('defaults is_private to false when null', async () => {
    mockSingle.mockResolvedValue({
      data: { is_private: null, is_searchable: true },
      error: null,
    });
    const result = await fetchPrivacySettings('user-1');
    expect(result?.is_private).toBe(false);
  });

  it('defaults is_searchable to true when null', async () => {
    mockSingle.mockResolvedValue({
      data: { is_private: false, is_searchable: null },
      error: null,
    });
    const result = await fetchPrivacySettings('user-1');
    expect(result?.is_searchable).toBe(true);
  });

  it('returns null on supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    expect(await fetchPrivacySettings('user-1')).toBeNull();
  });

  it('queries the users table with the correct userId', async () => {
    mockSingle.mockResolvedValue({ data: { is_private: false, is_searchable: true }, error: null });
    await fetchPrivacySettings('user-42');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(queryChain.eq).toHaveBeenCalledWith('id', 'user-42');
  });
});

// ─── updatePrivacySetting ────────────────────────────────────────────────────

describe('updatePrivacySetting', () => {
  it('returns true on success', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await updatePrivacySetting('user-1', 'is_private', true)).toBe(true);
  });

  it('returns false on supabase error', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: { message: 'err' } });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    expect(await updatePrivacySetting('user-1', 'is_private', true)).toBe(false);
  });

  it('passes the correct field and value for is_private', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    await updatePrivacySetting('user-1', 'is_private', true);
    expect(queryChain.update).toHaveBeenCalledWith({ is_private: true });
    expect(eqResult).toHaveBeenCalledWith('id', 'user-1');
  });

  it('passes the correct field and value for is_searchable', async () => {
    const eqResult = jest.fn().mockResolvedValue({ error: null });
    queryChain.update = jest.fn().mockReturnValue({ eq: eqResult });

    await updatePrivacySetting('user-99', 'is_searchable', false);
    expect(queryChain.update).toHaveBeenCalledWith({ is_searchable: false });
    expect(eqResult).toHaveBeenCalledWith('id', 'user-99');
  });
});
