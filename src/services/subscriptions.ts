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
    reportError(revError, 'subscriptions.isEitherFollowing');
    return false;
  }
  return !!rev;
}

export interface SuggestedUser {
  readonly id: string;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly is_private: boolean;
  readonly mutual_count: number;
}

export async function fetchSuggestedUsers(limit = 10): Promise<SuggestedUser[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase.rpc('get_suggested_users', { limit_count: limit });

  if (error) {
    reportError(error, 'subscriptions.fetchSuggestedUsers');
    return [];
  }
  return (data as SuggestedUser[]) || [];
}

export interface FollowerUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export async function fetchFollowers(userId: string): Promise<FollowerUser[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('follower:users!follower_id(id, display_name, avatar_url)')
    .eq('following_id', userId);

  if (error) {
    reportError(error, 'subscriptions.fetchFollowers');
    return [];
  }

  return (data || []).map((row: any) => row.follower).filter(Boolean);
}

export async function fetchFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (error) {
    reportError(error, 'subscriptions.fetchFollowerCount');
    return 0;
  }
  return count || 0;
}
