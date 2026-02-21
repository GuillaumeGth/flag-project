import { supabase, getCachedUserId } from './supabase';
import { reportError } from './errorReporting';

function getCurrentUserId(): string | null {
  return getCachedUserId();
}

export interface NotificationPrefs {
  notifyPrivateFlags: boolean;
  notifyPublicFlags: boolean;
}

export async function fetchNotificationPrefs(followingId: string): Promise<NotificationPrefs> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return { notifyPrivateFlags: true, notifyPublicFlags: false };
  const { data } = await supabase
    .from('subscriptions')
    .select('notify_private_flags, notify_public_flags')
    .eq('follower_id', currentUserId)
    .eq('following_id', followingId)
    .maybeSingle();
  return {
    notifyPrivateFlags: data?.notify_private_flags ?? true,
    notifyPublicFlags: data?.notify_public_flags ?? false,
  };
}

export async function updateNotificationPrefs(
  followingId: string,
  prefs: Partial<NotificationPrefs>
): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;
  const update: Record<string, boolean> = {};
  if (prefs.notifyPrivateFlags !== undefined) update.notify_private_flags = prefs.notifyPrivateFlags;
  if (prefs.notifyPublicFlags !== undefined) update.notify_public_flags = prefs.notifyPublicFlags;
  const { error } = await supabase
    .from('subscriptions')
    .update(update)
    .eq('follower_id', currentUserId)
    .eq('following_id', followingId);
  if (error) {
    reportError(error, 'subscriptions.updateNotificationPrefs');
    return false;
  }
  return true;
}

export async function follow(userId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('subscriptions')
    .insert({ follower_id: currentUserId, following_id: userId });

  if (error) {
    console.error('Error following user:', error);
    reportError(error, 'subscriptions.follow');
    return false;
  }
  return true;
}

export async function unfollow(userId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('following_id', userId);

  if (error) {
    console.error('Error unfollowing user:', error);
    reportError(error, 'subscriptions.unfollow');
    return false;
  }
  return true;
}

export async function isFollowing(userId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('follower_id', currentUserId)
    .eq('following_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking follow status:', error);
    reportError(error, 'subscriptions.isFollowing');
    return false;
  }
  return !!data;
}

export async function fetchFollowingIds(): Promise<string[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('subscriptions')
    .select('following_id')
    .eq('follower_id', currentUserId);

  if (error) {
    console.error('Error fetching following ids:', error);
    reportError(error, 'subscriptions.fetchFollowingIds');
    return [];
  }

  return (data || []).map(row => row.following_id);
}

export async function isEitherFollowing(userId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  // Check if current user follows the other user
  const { data: fwd, error: fwdError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('follower_id', currentUserId)
    .eq('following_id', userId)
    .maybeSingle();

  if (!fwdError && fwd) return true;

  // Check if the other user follows the current user
  const { data: rev, error: revError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', currentUserId)
    .maybeSingle();

  if (revError) {
    console.error('Error checking mutual follow status:', revError);
    reportError(revError, 'subscriptions.isEitherFollowing');
    return false;
  }
  return !!rev;
}

export async function fetchFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (error) {
    console.error('Error fetching follower count:', error);
    return 0;
  }
  return count || 0;
}
