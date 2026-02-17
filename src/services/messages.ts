import { supabase, getCachedUserId } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Message, MessageWithSender, Coordinates, User, UndiscoveredMessageMeta, UndiscoveredMessageMapMeta, Conversation, MessageWithUsers } from '@/types';
import {
  getCachedData,
  setCachedData,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  CACHE_KEYS,
} from './cache';
import { reportError } from './errorReporting';

// Default Flag Bot user ID (created via seed.sql)
export const FLAG_BOT_ID = '00000000-0000-0000-0000-000000000001';

// Helper to get current user ID from cached value (avoids getSession() deadlock)
function getCurrentUserId(): string | null {
  const userId = getCachedUserId();
  console.log('[messages] getCurrentUserId:', userId);
  return userId;
}

// Fetch only users the current user is subscribed to (for recipient selection)
export async function fetchFollowedUsers(): Promise<User[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  // Get IDs of users the current user follows
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('following_id')
    .eq('follower_id', currentUserId);

  if (subsError || !subs || subs.length === 0) return [];

  const followingIds = subs.map(s => s.following_id);

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', followingIds)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching followed users:', error);
    reportError(error, 'messages.fetchFollowedUsers');
    return [];
  }

  return data || [];
}

// Build conversations from a list of messages (with user joins)
function buildConversations(messages: any[], currentUserId: string): Conversation[] {
  const conversationsMap = new Map<string, Conversation>();

  // Sort by created_at descending to ensure first entry per user is the latest message
  const sorted = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const msg of sorted) {
    const isFromMe = msg.sender_id === currentUserId;
    const otherUserId = isFromMe ? msg.recipient_id : msg.sender_id;
    const otherUser = isFromMe ? msg.recipient : msg.sender;

    if (!otherUser || !otherUserId) continue;

    if (!conversationsMap.has(otherUserId)) {
      const unreadCount = sorted.filter(
        m => m.sender_id === otherUserId && m.recipient_id === currentUserId && !m.is_read
      ).length;

      conversationsMap.set(otherUserId, {
        id: otherUserId,
        otherUser: {
          id: otherUser.id,
          display_name: otherUser.display_name,
          avatar_url: otherUser.avatar_url,
        },
        lastMessage: {
          id: msg.id,
          content_type: msg.content_type,
          text_content: msg.text_content,
          created_at: msg.created_at,
          is_read: msg.is_read,
          is_from_me: isFromMe,
        },
        unreadCount,
      });
    }
  }

  return Array.from(conversationsMap.values());
}

// Fetch all conversations for current user (with local cache + incremental sync)
export async function fetchConversations(): Promise<Conversation[]> {
  console.log('[messages] fetchConversations: START');
  const currentUserId = await getCurrentUserId();
  console.log('[messages] fetchConversations: currentUserId =', currentUserId);
  if (!currentUserId) {
    console.log('[messages] fetchConversations: NO USER ID - returning empty');
    return [];
  }

  const cacheKey = CACHE_KEYS.CONVERSATIONS_MESSAGES;
  const lastSync = await getLastSyncTimestamp(cacheKey);
  const cachedMessages: any[] = (await getCachedData<any[]>(cacheKey)) || [];

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (id, display_name, avatar_url),
      recipient:users!recipient_id (id, display_name, avatar_url)
    `)
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  // If we have a last sync, only fetch newer messages
  if (lastSync) {
    query = query.gt('created_at', lastSync);
  }

  const { data: newMessages, error } = await query;

  console.log('[messages] fetchConversations: query done, error =', error, 'new count =', newMessages?.length, 'cached count =', cachedMessages.length);
  if (error) {
    console.error('Error fetching conversations:', error);
    reportError(error, 'messages.fetchConversations');
    // On error, still return conversations from cache
    if (cachedMessages.length > 0) {
      return buildConversations(cachedMessages, currentUserId);
    }
    return [];
  }

  // Merge: replace existing messages by id, add new ones
  const mergedMap = new Map<string, any>();
  for (const msg of cachedMessages) {
    mergedMap.set(msg.id, msg);
  }
  for (const msg of (newMessages || [])) {
    mergedMap.set(msg.id, msg);
  }
  const allMessages = Array.from(mergedMap.values());

  // Update cache
  const syncTimestamp = new Date().toISOString();
  await setCachedData(cacheKey, allMessages);
  await setLastSyncTimestamp(cacheKey, syncTimestamp);

  return buildConversations(allMessages, currentUserId);
}

/**
 * Get cached conversations immediately (for instant UI display).
 * Returns null if no cache exists.
 */
export async function getCachedConversations(): Promise<Conversation[] | null> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return null;

  const cachedMessages = await getCachedData<any[]>(CACHE_KEYS.CONVERSATIONS_MESSAGES);
  if (!cachedMessages || cachedMessages.length === 0) return null;

  return buildConversations(cachedMessages, currentUserId);
}

// Fetch all messages for a specific conversation (with local cache + incremental sync)
export async function fetchConversationMessages(otherUserId: string): Promise<MessageWithUsers[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const cacheKey = CACHE_KEYS.CONVERSATION(otherUserId);
  const lastSync = await getLastSyncTimestamp(cacheKey);
  const cachedMessages: MessageWithUsers[] = (await getCachedData<MessageWithUsers[]>(cacheKey)) || [];

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (id, display_name, avatar_url),
      recipient:users!recipient_id (id, display_name, avatar_url)
    `)
    .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
    .order('created_at', { ascending: true });

  if (lastSync) {
    query = query.gt('created_at', lastSync);
  }

  const { data: newMessages, error } = await query;

  if (error) {
    console.error('Error fetching conversation messages:', error);
    reportError(error, 'messages.fetchConversationMessages');
    return cachedMessages.length > 0 ? cachedMessages : [];
  }

  // Merge by id
  const mergedMap = new Map<string, MessageWithUsers>();
  for (const msg of cachedMessages) {
    mergedMap.set(msg.id, msg);
  }
  for (const msg of (newMessages || []) as MessageWithUsers[]) {
    mergedMap.set(msg.id, msg);
  }

  // Sort by created_at ascending
  const allMessages = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Update cache
  const syncTimestamp = new Date().toISOString();
  await setCachedData(cacheKey, allMessages);
  await setLastSyncTimestamp(cacheKey, syncTimestamp);

  return allMessages;
}

/**
 * Get cached conversation messages immediately (for instant UI display).
 */
export async function getCachedConversationMessages(otherUserId: string): Promise<MessageWithUsers[] | null> {
  const cached = await getCachedData<MessageWithUsers[]>(CACHE_KEYS.CONVERSATION(otherUserId));
  if (!cached || cached.length === 0) return null;
  return cached;
}

// Fetch messages for current user (as recipient)
export async function fetchMyMessages(): Promise<MessageWithSender[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('recipient_id', currentUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    reportError(error, 'messages.fetchMyMessages');
    return [];
  }

  return data || [];
}

// Fetch unread messages for map display
export async function fetchUnreadMessages(): Promise<MessageWithSender[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching unread messages:', error);
    reportError(error, 'messages.fetchUnreadMessages');
    return [];
  }

  return data || [];
}

// Fetch read messages (inbox)
export async function fetchReadMessages(): Promise<MessageWithSender[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('recipient_id', currentUserId)
    .eq('is_read', true)
    .order('read_at', { ascending: false });

  if (error) {
    console.error('Error fetching read messages:', error);
    reportError(error, 'messages.fetchReadMessages');
    return [];
  }

  return data || [];
}

// Fetch only metadata for undiscovered messages (no content for security)
export async function fetchUndiscoveredMessagesMetadata(): Promise<UndiscoveredMessageMeta[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, created_at, is_read')
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching undiscovered messages metadata:', error);
    reportError(error, 'messages.fetchUndiscoveredMessagesMetadata');
    return [];
  }

  return data || [];
}

// Fetch only location metadata for map markers (no content for security)
// Uses cache + incremental sync. Also removes messages that have been read.
export async function fetchUndiscoveredMessagesForMap(): Promise<UndiscoveredMessageMapMeta[]> {
  console.log('[messages] fetchUndiscoveredMessagesForMap: START');
  const currentUserId = await getCurrentUserId();
  console.log('[messages] fetchUndiscoveredMessagesForMap: currentUserId =', currentUserId);
  if (!currentUserId) {
    console.log('[messages] fetchUndiscoveredMessagesForMap: NO USER ID - returning empty');
    return [];
  }

  const cacheKey = CACHE_KEYS.MAP_MESSAGES;
  const lastSync = await getLastSyncTimestamp(cacheKey);
  const cachedMessages: UndiscoveredMessageMapMeta[] = (await getCachedData<UndiscoveredMessageMapMeta[]>(cacheKey)) || [];

  let query = supabase
    .from('messages')
    .select(`
      id,
      location,
      created_at,
      is_public,
      sender:users!sender_id (id, display_name, avatar_url)
    `)
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (lastSync) {
    query = query.gt('created_at', lastSync);
  }

  const { data: newMessages, error } = await query;
  console.log('[messages] fetchUndiscoveredMessagesForMap: query done, error =', error, 'new count =', newMessages?.length, 'cached count =', cachedMessages.length);

  if (error) {
    console.error('Error fetching undiscovered messages for map:', error);
    reportError(error, 'messages.fetchUndiscoveredMessagesForMap');
    return cachedMessages.length > 0 ? cachedMessages : [];
  }

  // Merge by id
  const mergedMap = new Map<string, UndiscoveredMessageMapMeta>();
  for (const msg of cachedMessages) {
    mergedMap.set(msg.id, msg);
  }
  for (const msg of (newMessages || []) as unknown as UndiscoveredMessageMapMeta[]) {
    mergedMap.set(msg.id, msg);
  }

  // Remove messages that have been read (check against conversations cache)
  // We fetch the list of read message IDs to prune the cache
  const { data: readIds } = await supabase
    .from('messages')
    .select('id')
    .eq('recipient_id', currentUserId)
    .eq('is_read', true)
    .in('id', Array.from(mergedMap.keys()));

  if (readIds) {
    for (const { id } of readIds) {
      mergedMap.delete(id);
    }
  }

  const allMessages = Array.from(mergedMap.values());

  // Update cache
  const syncTimestamp = new Date().toISOString();
  await setCachedData(cacheKey, allMessages);
  await setLastSyncTimestamp(cacheKey, syncTimestamp);

  return allMessages;
}

/**
 * Get cached map messages immediately (for instant UI display).
 */
export async function getCachedMapMessages(): Promise<UndiscoveredMessageMapMeta[] | null> {
  const cached = await getCachedData<UndiscoveredMessageMapMeta[]>(CACHE_KEYS.MAP_MESSAGES);
  if (!cached || cached.length === 0) return null;
  return cached;
}

// Fetch a single message by ID with full content
export async function fetchMessageById(messageId: string): Promise<MessageWithSender | null> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('id', messageId)
    .single();

  if (error) {
    console.error('Error fetching message by id:', error);
    reportError(error, 'messages.fetchMessageById');
    return null;
  }

  return data;
}

// Fetch current user's public messages
export async function fetchMyPublicMessages(): Promise<Message[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('sender_id', currentUserId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching public messages:', error);
    reportError(error, 'messages.fetchMyPublicMessages');
    return [];
  }

  return data || [];
}

// Fetch public messages for a specific user (for UserProfileScreen)
export async function fetchUserPublicMessages(userId: string): Promise<Message[]> {
  console.log('[messages] fetchUserPublicMessages: userId =', userId);

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('sender_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  console.log('[messages] fetchUserPublicMessages: data =', data?.length, 'error =', error);

  if (error) {
    console.error('Error fetching user public messages:', error);
    reportError(error, 'messages.fetchUserPublicMessages');
    return [];
  }

  return data || [];
}

// Fetch public messages from all followed users (for map display)
export async function fetchFollowingPublicMessages(): Promise<UndiscoveredMessageMapMeta[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  // First get list of following IDs
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('following_id')
    .eq('follower_id', currentUserId);

  if (subsError || !subs || subs.length === 0) return [];

  const followingIds = subs.map(s => s.following_id);

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      location,
      created_at,
      is_public,
      sender:users!sender_id (id, display_name, avatar_url)
    `)
    .in('sender_id', followingIds)
    .eq('is_public', true)
    .not('location', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching following public messages:', error);
    reportError(error, 'messages.fetchFollowingPublicMessages');
    return [];
  }

  return (data || []) as unknown as UndiscoveredMessageMapMeta[];
}

// Mark a public message as discovered by the current user
export async function markPublicMessageDiscovered(messageId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('discovered_public_messages')
    .upsert({ user_id: currentUserId, message_id: messageId }, { onConflict: 'user_id,message_id' });

  if (error) {
    console.error('Error marking public message as discovered:', error);
    reportError(error, 'messages.markPublicMessageDiscovered');
    return false;
  }
  return true;
}

// Fetch IDs of public messages discovered by current user (for a given list of message IDs)
export async function fetchDiscoveredPublicMessageIds(messageIds: string[]): Promise<Set<string>> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId || messageIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('discovered_public_messages')
    .select('message_id')
    .eq('user_id', currentUserId)
    .in('message_id', messageIds);

  if (error) {
    console.error('Error fetching discovered public messages:', error);
    reportError(error, 'messages.fetchDiscoveredPublicMessageIds');
    return new Set();
  }

  return new Set((data || []).map(d => d.message_id));
}

// Send a new message (only to users the sender is subscribed to)
export async function sendMessage(
  recipientId: string | null,
  contentType: 'text' | 'photo' | 'audio',
  location: Coordinates | null,
  textContent?: string,
  mediaUrl?: string,
  isPublic?: boolean
): Promise<Message | null> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    console.error('sendMessage: No authenticated user');
    return null;
  }

  // Subscription check is handled by the database RLS policy on messages table
  console.log('sendMessage:', { recipientId, contentType, hasText: !!textContent, hasMedia: !!mediaUrl, hasLocation: !!location, isPublic });

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: currentUserId,
      recipient_id: recipientId,
      content_type: contentType,
      text_content: textContent,
      media_url: mediaUrl,
      location: location ? `POINT(${location.longitude} ${location.latitude})` : null,
is_read: location ? false : true, // Messages without location are immediately readable
      is_public: isPublic || false,
    })
    .select()
    .single();

  if (error) {
    console.error('sendMessage error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    reportError(error, 'messages.sendMessage', { recipientId, contentType, isPublic });
    return null;
  }

  return data;
}

// Mark message as read and update local caches
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const readAt = new Date().toISOString();

  const { error } = await supabase
    .from('messages')
    .update({
      is_read: true,
      read_at: readAt,
    })
    .eq('id', messageId);

  if (error) {
    console.error('Error marking message as read:', error);
    reportError(error, 'messages.markMessageAsRead');
    return false;
  }

  // Remove from map messages cache (no longer undiscovered)
  const mapCached = await getCachedData<UndiscoveredMessageMapMeta[]>(CACHE_KEYS.MAP_MESSAGES);
  if (mapCached) {
    const updated = mapCached.filter(m => m.id !== messageId);
    await setCachedData(CACHE_KEYS.MAP_MESSAGES, updated);
  }

  // Update read status in conversations cache
  const convCached = await getCachedData<any[]>(CACHE_KEYS.CONVERSATIONS_MESSAGES);
  if (convCached) {
    const updated = convCached.map(m =>
      m.id === messageId ? { ...m, is_read: true, read_at: readAt } : m
    );
    await setCachedData(CACHE_KEYS.CONVERSATIONS_MESSAGES, updated);
  }

  return true;
}

// Upload media (photo or audio)
export async function uploadMedia(
  uri: string,
  type: 'photo' | 'audio'
): Promise<string | null> {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      console.error('No authenticated user');
      return null;
    }

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // Determine extension and content type
    const ext = type === 'photo' ? 'jpg' : 'm4a';
    const contentType = type === 'photo' ? 'image/jpeg' : 'audio/m4a';
    const fileName = `${currentUserId}/${Date.now()}.${ext}`;

    // Convert base64 to ArrayBuffer
    const { decode } = await import('base64-arraybuffer');
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage
      .from('media')
      .upload(fileName, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading media:', error.message, error);
      reportError(error, 'messages.uploadMedia', { type });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (e) {
    console.error('Exception during media upload:', e);
    reportError(e, 'messages.uploadMedia');
    return null;
  }
}
