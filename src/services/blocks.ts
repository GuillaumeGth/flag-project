import { supabase, getCachedUserId } from './supabase';
import { reportError } from './errorReporting';
import { unfollow } from './subscriptions';

function getCurrentUserId(): string | null {
  return getCachedUserId();
}

/**
 * Block a user. Unidirectional: `blocked_id` becomes invisible to the current user.
 * Also removes any existing follow relationship in both directions.
 */
export async function blockUser(blockedId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: currentUserId, blocked_id: blockedId });

  if (error) {
    reportError(error, 'blocks.blockUser');
    return false;
  }

  // Remove follow relationships in both directions (fire-and-forget, ignore errors)
  await Promise.allSettled([
    unfollow(blockedId),
    supabase
      .from('subscriptions')
      .delete()
      .eq('follower_id', blockedId)
      .eq('following_id', currentUserId),
  ]);

  return true;
}

/**
 * Unblock a user.
 */
export async function unblockUser(blockedId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', currentUserId)
    .eq('blocked_id', blockedId);

  if (error) {
    reportError(error, 'blocks.unblockUser');
    return false;
  }

  return true;
}

/**
 * Check whether the current user has blocked a specific user.
 */
export async function isBlocked(blockedId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', currentUserId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  if (error) {
    reportError(error, 'blocks.isBlocked');
    return false;
  }

  return !!data;
}

/**
 * Fetch the list of user IDs blocked by the current user.
 * Used to filter out blocked users from search results, map markers, and conversations.
 */
export async function fetchBlockedIds(): Promise<string[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', currentUserId);

  if (error) {
    reportError(error, 'blocks.fetchBlockedIds');
    return [];
  }

  return (data || []).map(row => row.blocked_id);
}
