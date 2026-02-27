/**
 * Tests for reactions.ts
 *
 * Covers:
 * 1. fetchReactionsForMessages — batched fetch, aggregation, current user flag
 * 2. toggleReaction — insert (add) and delete (remove) paths
 * 3. Emoji allowlist validation
 * 4. Empty input handling
 * 5. Supabase error resilience
 */

jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

import { reportError } from '@/services/errorReporting';
import { supabase } from '@/services/supabase';
import {
  fetchReactionsForMessages,
  toggleReaction,
  ALLOWED_EMOJIS,
} from '@/services/reactions';

const mockFrom = supabase.from as jest.Mock;
const mockReportError = reportError as jest.Mock;

// ─── Query chain builder ──────────────────────────────────────────────────────
function makeChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'insert', 'delete'];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  // Make the chain awaitable
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return chain;
}

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';
const MSG_1 = 'msg-1-uuid';
const MSG_2 = 'msg-2-uuid';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ALLOWED_EMOJIS', () => {
  it('contains exactly 6 emoji', () => {
    expect(ALLOWED_EMOJIS).toHaveLength(6);
  });

  it('includes the standard reaction set', () => {
    expect(ALLOWED_EMOJIS).toContain('❤️');
    expect(ALLOWED_EMOJIS).toContain('😂');
    expect(ALLOWED_EMOJIS).toContain('👍');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('fetchReactionsForMessages', () => {
  it('returns an empty object immediately when no message IDs provided', async () => {
    const result = await fetchReactionsForMessages([], USER_A);
    expect(result).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('initialises all requested message IDs with empty arrays', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchReactionsForMessages([MSG_1, MSG_2], USER_A);

    expect(result[MSG_1]).toEqual([]);
    expect(result[MSG_2]).toEqual([]);
  });

  it('aggregates reactions by emoji and sets has_reacted for current user', async () => {
    const rawReactions = [
      { id: '1', message_id: MSG_1, user_id: USER_A, emoji: '❤️', created_at: '' },
      { id: '2', message_id: MSG_1, user_id: USER_B, emoji: '❤️', created_at: '' },
      { id: '3', message_id: MSG_1, user_id: USER_B, emoji: '😂', created_at: '' },
    ];
    const chain = makeChain({ data: rawReactions, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchReactionsForMessages([MSG_1], USER_A);
    const reactions = result[MSG_1];

    const heart = reactions.find((r) => r.emoji === '❤️')!;
    expect(heart.count).toBe(2);
    expect(heart.has_reacted).toBe(true);
    expect(heart.user_ids).toContain(USER_A);
    expect(heart.user_ids).toContain(USER_B);

    const laugh = reactions.find((r) => r.emoji === '😂')!;
    expect(laugh.count).toBe(1);
    expect(laugh.has_reacted).toBe(false);
  });

  it('segregates reactions by message_id correctly', async () => {
    const rawReactions = [
      { id: '1', message_id: MSG_1, user_id: USER_A, emoji: '👍', created_at: '' },
      { id: '2', message_id: MSG_2, user_id: USER_B, emoji: '😢', created_at: '' },
    ];
    const chain = makeChain({ data: rawReactions, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchReactionsForMessages([MSG_1, MSG_2], USER_A);

    expect(result[MSG_1]).toHaveLength(1);
    expect(result[MSG_1][0].emoji).toBe('👍');
    expect(result[MSG_2]).toHaveLength(1);
    expect(result[MSG_2][0].emoji).toBe('😢');
  });

  it('returns empty arrays on Supabase error and calls reportError', async () => {
    const chain = makeChain({ data: null, error: new Error('DB failure') });
    mockFrom.mockReturnValue(chain);

    const result = await fetchReactionsForMessages([MSG_1], USER_A);

    expect(result[MSG_1]).toEqual([]);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'reactions.fetchReactionsForMessages'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('toggleReaction', () => {
  it('inserts a new reaction when hasReacted is false', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await toggleReaction(MSG_1, '❤️', USER_A, false);

    expect(mockFrom).toHaveBeenCalledWith('message_reactions');
    expect(chain.insert).toHaveBeenCalledWith({
      message_id: MSG_1,
      user_id: USER_A,
      emoji: '❤️',
    });
  });

  it('deletes the reaction when hasReacted is true', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await toggleReaction(MSG_1, '👍', USER_A, true);

    expect(mockFrom).toHaveBeenCalledWith('message_reactions');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('message_id', MSG_1);
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_A);
    expect(chain.eq).toHaveBeenCalledWith('emoji', '👍');
  });

  it('does nothing for an emoji not in the allowlist', async () => {
    await toggleReaction(MSG_1, '🚀', USER_A, false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('calls reportError on insert failure', async () => {
    const chain = makeChain({ data: null, error: new Error('insert failed') });
    mockFrom.mockReturnValue(chain);

    await toggleReaction(MSG_1, '😂', USER_A, false);

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'reactions.toggleReaction.insert'
    );
  });

  it('calls reportError on delete failure', async () => {
    const chain = makeChain({ data: null, error: new Error('delete failed') });
    mockFrom.mockReturnValue(chain);

    await toggleReaction(MSG_1, '😢', USER_A, true);

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'reactions.toggleReaction.delete'
    );
  });

  it('accepts all emojis in the allowlist without filtering', async () => {
    for (const emoji of ALLOWED_EMOJIS) {
      jest.clearAllMocks();
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      await toggleReaction(MSG_1, emoji, USER_A, false);
      expect(mockFrom).toHaveBeenCalledTimes(1);
    }
  });
});
