import { supabase } from './supabase';
import { Comment, CommentWithUser, CommentWithReplies } from '@/types/comments';
import { reportError } from './errorReporting';

/**
 * Fetch all comments for a message, grouped with replies, likes, and user info.
 * Root comments are sorted newest-first; replies are sorted oldest-first.
 */
export async function fetchCommentsForMessage(
  messageId: string,
  currentUserId: string
): Promise<CommentWithReplies[]> {
  const { data: rawComments, error: commentsError } = await supabase
    .from('message_comments')
    .select('*, user:users!message_comments_user_id_fkey(id, display_name, avatar_url)')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    reportError(commentsError, 'comments.fetchCommentsForMessage');
    return [];
  }

  if (!rawComments || rawComments.length === 0) return [];

  const comments = rawComments as (Comment & { user: CommentWithUser['user'] })[];
  const commentIds = comments.map(c => c.id);

  // Fetch likes for all comments in one query
  const { data: likesData, error: likesError } = await supabase
    .from('comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', commentIds);

  if (likesError) {
    reportError(likesError, 'comments.fetchCommentsForMessage.likes');
  }

  const likes = likesData ?? [];
  const likesByComment = new Map<string, { count: number; hasLiked: boolean }>();
  for (const like of likes) {
    const entry = likesByComment.get(like.comment_id) ?? { count: 0, hasLiked: false };
    entry.count++;
    if (like.user_id === currentUserId) entry.hasLiked = true;
    likesByComment.set(like.comment_id, entry);
  }

  // Separate root comments and replies
  const roots: CommentWithReplies[] = [];
  const repliesByParent = new Map<string, CommentWithUser[]>();

  for (const c of comments) {
    if (c.parent_comment_id) {
      const list = repliesByParent.get(c.parent_comment_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_comment_id, list);
    } else {
      const likeInfo = likesByComment.get(c.id) ?? { count: 0, hasLiked: false };
      roots.push({
        ...c,
        replies: [],
        like_count: likeInfo.count,
        has_liked: likeInfo.hasLiked,
      });
    }
  }

  // Attach replies to their parent (already sorted chronologically from query)
  for (const root of roots) {
    root.replies = repliesByParent.get(root.id) ?? [];
    // Enrich replies with like info too
    for (const reply of root.replies) {
      const likeInfo = likesByComment.get(reply.id) ?? { count: 0, hasLiked: false };
      (reply as CommentWithReplies).like_count = likeInfo.count;
      (reply as CommentWithReplies).has_liked = likeInfo.hasLiked;
    }
  }

  // Root comments: newest first
  roots.reverse();

  return roots;
}

/**
 * Fetch comment counts for a batch of message IDs.
 * Returns a map of messageId → count (only IDs with comments are included).
 */
export async function fetchCommentCounts(
  messageIds: string[]
): Promise<Record<string, number>> {
  if (messageIds.length === 0) return {};

  const { data, error } = await supabase
    .rpc('get_comment_counts', { message_ids: messageIds });

  if (error) {
    // Fallback: count via individual query if RPC doesn't exist
    reportError(error, 'comments.fetchCommentCounts.rpc');
    return fetchCommentCountsFallback(messageIds);
  }

  const result: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      result[row.message_id] = Number(row.count);
    }
  }
  return result;
}

async function fetchCommentCountsFallback(
  messageIds: string[]
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('message_comments')
    .select('message_id')
    .in('message_id', messageIds);

  if (error) {
    reportError(error, 'comments.fetchCommentCountsFallback');
    return {};
  }

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.message_id] = (result[row.message_id] ?? 0) + 1;
  }
  return result;
}

/**
 * Create a comment on a public message.
 */
export async function createComment(
  messageId: string,
  textContent: string,
  parentCommentId?: string
): Promise<Comment | null> {
  const trimmed = textContent.trim();
  if (!trimmed) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('message_comments')
    .insert({
      message_id: messageId,
      user_id: user.id,
      parent_comment_id: parentCommentId ?? null,
      text_content: trimmed,
    })
    .select()
    .single();

  if (error) {
    reportError(error, 'comments.createComment');
    return null;
  }

  return data;
}

/**
 * Delete a comment (only own comments, enforced by RLS).
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('message_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    reportError(error, 'comments.deleteComment');
    return false;
  }
  return true;
}

/**
 * Toggle like on a comment (heart).
 * If hasLiked is true, removes the like; otherwise adds it.
 */
/**
 * Fetch like info (count + has_liked) for a batch of public messages.
 * Uses the message_reactions table with emoji ❤️.
 */
export async function fetchMessageLikes(
  messageIds: string[],
  currentUserId: string
): Promise<Record<string, { count: number; hasLiked: boolean }>> {
  if (messageIds.length === 0) return {};

  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id')
    .in('message_id', messageIds)
    .eq('emoji', '❤️');

  if (error) {
    reportError(error, 'comments.fetchMessageLikes');
    return {};
  }

  const result: Record<string, { count: number; hasLiked: boolean }> = {};
  for (const row of data ?? []) {
    if (!result[row.message_id]) {
      result[row.message_id] = { count: 0, hasLiked: false };
    }
    result[row.message_id].count++;
    if (row.user_id === currentUserId) {
      result[row.message_id].hasLiked = true;
    }
  }
  return result;
}

/**
 * Toggle a ❤️ like on a public message.
 */
export async function toggleMessageLike(
  messageId: string,
  hasLiked: boolean
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (hasLiked) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', '❤️');

    if (error) {
      reportError(error, 'comments.toggleMessageLike.delete');
      return false;
    }
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji: '❤️' });

    if (error) {
      reportError(error, 'comments.toggleMessageLike.insert');
      return false;
    }
  }
  return true;
}

export async function toggleCommentLike(
  commentId: string,
  hasLiked: boolean
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (hasLiked) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id);

    if (error) {
      reportError(error, 'comments.toggleCommentLike.delete');
      return false;
    }
  } else {
    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: user.id });

    if (error) {
      reportError(error, 'comments.toggleCommentLike.insert');
      return false;
    }
  }
  return true;
}
