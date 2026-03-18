/**
 * Tests for comments.ts
 *
 * Covers:
 * 1. fetchCommentsForMessage — fetch, group replies, compute likes
 * 2. fetchCommentCounts — batch comment counts
 * 3. createComment — root and reply creation, empty text guard
 * 4. deleteComment — deletion path
 * 5. toggleCommentLike — like/unlike toggle
 * 6. Error resilience
 */

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
  },
}));
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

import { reportError } from '@/services/errorReporting';
import { supabase } from '@/services/supabase';
import {
  fetchCommentsForMessage,
  fetchCommentCounts,
  createComment,
  deleteComment,
  toggleCommentLike,
} from '@/services/comments';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = (supabase as any).rpc as jest.Mock;
const mockGetUser = (supabase.auth as any).getUser as jest.Mock;
const mockReportError = reportError as jest.Mock;

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';
const MSG_1 = 'msg-1-uuid';
const COMMENT_1 = 'comment-1-uuid';
const COMMENT_2 = 'comment-2-uuid';
const REPLY_1 = 'reply-1-uuid';

// ─── Query chain builder ──────────────────────────────────────────────────────
function makeChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'insert', 'delete', 'order', 'single'];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('fetchCommentsForMessage', () => {
  it('returns empty array when no comments exist', async () => {
    // First call: comments query
    const commentsChain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(commentsChain);

    const result = await fetchCommentsForMessage(MSG_1, USER_A);
    expect(result).toEqual([]);
  });

  it('groups replies under parent comments', async () => {
    const rawComments = [
      {
        id: COMMENT_1, message_id: MSG_1, user_id: USER_A,
        parent_comment_id: null, text_content: 'Root comment', created_at: '2026-01-01T00:00:00Z',
        user: { id: USER_A, display_name: 'Alice', avatar_url: null },
      },
      {
        id: REPLY_1, message_id: MSG_1, user_id: USER_B,
        parent_comment_id: COMMENT_1, text_content: 'Reply', created_at: '2026-01-01T01:00:00Z',
        user: { id: USER_B, display_name: 'Bob', avatar_url: null },
      },
    ];

    // Comments query
    const commentsChain = makeChain({ data: rawComments, error: null });
    // Likes query
    const likesChain = makeChain({ data: [], error: null });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? commentsChain : likesChain;
    });

    const result = await fetchCommentsForMessage(MSG_1, USER_A);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(COMMENT_1);
    expect(result[0].replies).toHaveLength(1);
    expect(result[0].replies[0].id).toBe(REPLY_1);
  });

  it('computes like counts and has_liked correctly', async () => {
    const rawComments = [
      {
        id: COMMENT_1, message_id: MSG_1, user_id: USER_B,
        parent_comment_id: null, text_content: 'Nice!', created_at: '2026-01-01T00:00:00Z',
        user: { id: USER_B, display_name: 'Bob', avatar_url: null },
      },
    ];
    const rawLikes = [
      { comment_id: COMMENT_1, user_id: USER_A },
      { comment_id: COMMENT_1, user_id: USER_B },
    ];

    const commentsChain = makeChain({ data: rawComments, error: null });
    const likesChain = makeChain({ data: rawLikes, error: null });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? commentsChain : likesChain;
    });

    const result = await fetchCommentsForMessage(MSG_1, USER_A);

    expect(result[0].like_count).toBe(2);
    expect(result[0].has_liked).toBe(true);
  });

  it('returns empty array on Supabase error and calls reportError', async () => {
    const chain = makeChain({ data: null, error: new Error('DB failure') });
    mockFrom.mockReturnValue(chain);

    const result = await fetchCommentsForMessage(MSG_1, USER_A);

    expect(result).toEqual([]);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'comments.fetchCommentsForMessage'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('fetchCommentCounts', () => {
  it('returns empty object for empty input', async () => {
    const result = await fetchCommentCounts([]);
    expect(result).toEqual({});
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns counts from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { message_id: MSG_1, count: 5 },
      ],
      error: null,
    });

    const result = await fetchCommentCounts([MSG_1]);
    expect(result[MSG_1]).toBe(5);
  });

  it('falls back to manual count on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC not found') });

    const fallbackChain = makeChain({
      data: [
        { message_id: MSG_1 },
        { message_id: MSG_1 },
        { message_id: MSG_1 },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(fallbackChain);

    const result = await fetchCommentCounts([MSG_1]);

    expect(mockReportError).toHaveBeenCalled();
    expect(result[MSG_1]).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createComment', () => {
  it('returns null for empty text', async () => {
    const result = await createComment(MSG_1, '   ');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null if user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await createComment(MSG_1, 'Hello');
    expect(result).toBeNull();
  });

  it('creates a root comment successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });

    const createdComment = {
      id: COMMENT_1, message_id: MSG_1, user_id: USER_A,
      parent_comment_id: null, text_content: 'Hello', created_at: '2026-01-01',
    };
    const chain = makeChain({ data: createdComment, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await createComment(MSG_1, 'Hello');
    expect(result).toEqual(createdComment);
    expect(chain.insert).toHaveBeenCalledWith({
      message_id: MSG_1,
      user_id: USER_A,
      parent_comment_id: null,
      text_content: 'Hello',
    });
  });

  it('creates a reply comment with parent_comment_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });

    const chain = makeChain({ data: { id: REPLY_1 }, error: null });
    mockFrom.mockReturnValue(chain);

    await createComment(MSG_1, 'Reply text', COMMENT_1);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_comment_id: COMMENT_1 })
    );
  });

  it('returns null and reports error on Supabase failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });

    const chain = makeChain({ data: null, error: new Error('insert failed') });
    mockFrom.mockReturnValue(chain);

    const result = await createComment(MSG_1, 'Hello');
    expect(result).toBeNull();
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'comments.createComment'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deleteComment', () => {
  it('returns true on successful deletion', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await deleteComment(COMMENT_1);
    expect(result).toBe(true);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', COMMENT_1);
  });

  it('returns false and reports error on failure', async () => {
    const chain = makeChain({ data: null, error: new Error('delete failed') });
    mockFrom.mockReturnValue(chain);

    const result = await deleteComment(COMMENT_1);
    expect(result).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'comments.deleteComment'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('toggleCommentLike', () => {
  it('returns false if user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await toggleCommentLike(COMMENT_1, false);
    expect(result).toBe(false);
  });

  it('inserts a like when hasLiked is false', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await toggleCommentLike(COMMENT_1, false);
    expect(result).toBe(true);
    expect(chain.insert).toHaveBeenCalledWith({
      comment_id: COMMENT_1,
      user_id: USER_A,
    });
  });

  it('deletes a like when hasLiked is true', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await toggleCommentLike(COMMENT_1, true);
    expect(result).toBe(true);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('comment_id', COMMENT_1);
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_A);
  });

  it('returns false and reports error on insert failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });
    const chain = makeChain({ data: null, error: new Error('insert failed') });
    mockFrom.mockReturnValue(chain);

    const result = await toggleCommentLike(COMMENT_1, false);
    expect(result).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'comments.toggleCommentLike.insert'
    );
  });

  it('returns false and reports error on delete failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } } });
    const chain = makeChain({ data: null, error: new Error('delete failed') });
    mockFrom.mockReturnValue(chain);

    const result = await toggleCommentLike(COMMENT_1, true);
    expect(result).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'comments.toggleCommentLike.delete'
    );
  });
});
