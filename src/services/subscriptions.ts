import { supabase, getCachedUserId } from './supabase';
import { reportError } from './errorReporting';

function getCurrentUserId(): string | null {
  return getCachedUserId();
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
