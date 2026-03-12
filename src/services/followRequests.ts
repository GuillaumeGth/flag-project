import { supabase, getCachedUserId } from './supabase';
import { follow } from './subscriptions';
import { reportError } from './errorReporting';

export type FollowRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FollowRequest {
  id: string;
  requester_id: string;
  target_id: string;
  status: FollowRequestStatus;
  created_at: string;
  requester?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

/** Returns the pending request id if there is one from current user → targetId, else null */
export async function fetchSentRequestStatus(
  targetId: string,
): Promise<{ id: string; status: FollowRequestStatus } | null> {
  const currentUserId = getCachedUserId();
  if (!currentUserId) return null;

  const { data, error } = await supabase
    .from('follow_requests')
    .select('id, status')
    .eq('requester_id', currentUserId)
    .eq('target_id', targetId)
    .maybeSingle();

  if (error) {
    reportError(error, 'followRequests.fetchSentRequestStatus');
    return null;
  }
  return data ?? null;
}

/** Returns all pending requests received by the current user */
export async function fetchReceivedRequests(): Promise<FollowRequest[]> {
  const currentUserId = getCachedUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('follow_requests')
    .select('*, requester:users!follow_requests_requester_id_fkey(id, display_name, avatar_url)')
    .eq('target_id', currentUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    reportError(error, 'followRequests.fetchReceivedRequests');
    return [];
  }
  return (data as FollowRequest[]) ?? [];
}

/** Returns the count of pending requests received by the current user */
export async function fetchReceivedRequestsCount(): Promise<number> {
  const currentUserId = getCachedUserId();
  if (!currentUserId) return 0;

  const { count, error } = await supabase
    .from('follow_requests')
    .select('*', { count: 'exact', head: true })
    .eq('target_id', currentUserId)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}

/** Send a follow request to a private account */
export async function sendFollowRequest(targetId: string): Promise<string | null> {
  const currentUserId = getCachedUserId();
  if (!currentUserId) return null;

  const { data, error } = await supabase
    .from('follow_requests')
    .insert({ requester_id: currentUserId, target_id: targetId })
    .select('id')
    .single();

  if (error) {
    reportError(error, 'followRequests.sendFollowRequest');
    return null;
  }
  return data?.id ?? null;
}

/** Cancel a sent follow request */
export async function cancelFollowRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('id', requestId);

  if (error) {
    reportError(error, 'followRequests.cancelFollowRequest');
    return false;
  }
  return true;
}

/** Accept a received request — creates the subscription then marks as accepted */
export async function acceptFollowRequest(request: FollowRequest): Promise<boolean> {
  // Create the subscription first
  const ok = await follow(request.requester_id);
  if (!ok) return false;

  const { error } = await supabase
    .from('follow_requests')
    .update({ status: 'accepted' })
    .eq('id', request.id);

  if (error) {
    reportError(error, 'followRequests.acceptFollowRequest');
    return false;
  }
  return true;
}

/** Reject a received request */
export async function rejectFollowRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follow_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);

  if (error) {
    reportError(error, 'followRequests.rejectFollowRequest');
    return false;
  }
  return true;
}
