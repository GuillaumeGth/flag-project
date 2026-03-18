import { supabase, getCachedUserId } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Message, MessageWithSender, Coordinates, User, UndiscoveredMessageMeta, UndiscoveredMessageMapMeta, OwnFlagMapMeta, Conversation, MessageWithUsers, MessageContentType, MessageReply } from '@/types';
import {
  getCachedData,
  setCachedData,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getKeysWithPrefix,
  CACHE_KEYS,
} from './cache';
import { reportError } from './errorReporting';
import { log } from '@/utils/debug';

// Default Fläag Bot user ID (created via seed.sql)
export const FLAG_BOT_ID = '00000000-0000-0000-0000-000000000001';

// Shape of raw message rows returned by Supabase with user joins
type RawMessageWithUsers = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content_type: string;
  text_content?: string;
  media_url?: string;
  location?: unknown;
  created_at: string;
  read_at?: string;
  is_read: boolean;
  is_public?: boolean;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
  reply_to_id?: string | null;
  sender: { id: string; display_name?: string; avatar_url?: string } | null;
  recipient: { id: string; display_name?: string; avatar_url?: string } | null;
};

type RawReplyRow = {
  id: string;
  content_type: string;
  text_content?: string;
  media_url?: string;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
  sender_id: string;
  sender: { display_name?: string } | null;
};

// Fetch the reply-to message content for a set of IDs (avoids self-referential join issue in PostgREST)
async function fetchReplyMessages(ids: string[]): Promise<Map<string, MessageReply>> {
  const map = new Map<string, MessageReply>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('messages')
    .select('id, content_type, text_content, media_url, deleted_by_sender, deleted_by_recipient, sender_id, sender:users!sender_id(display_name)')
    .in('id', ids);

  if (error || !data) return map;

  for (const r of data as RawReplyRow[]) {
    map.set(r.id, {
      id: r.id,
      content_type: r.content_type as MessageContentType,
      text_content: r.text_content,
      media_url: r.media_url,
      deleted_by_sender: r.deleted_by_sender,
      deleted_by_recipient: r.deleted_by_recipient,
      sender: r.sender ? { display_name: r.sender.display_name } : null,
    });
  }
  return map;
}

// Maps a raw Supabase row to the typed MessageWithUsers
function mapRawMessage(raw: RawMessageWithUsers, replyMap: Map<string, MessageReply>): MessageWithUsers {
  const { reply_to_id, ...rest } = raw;
  return {
    ...rest,
    content_type: raw.content_type as MessageContentType,
    location: raw.location as unknown as Coordinates,
    sender: raw.sender ?? { id: '', display_name: undefined, avatar_url: undefined },
    recipient: raw.recipient ?? { id: '', display_name: undefined, avatar_url: undefined },
    reply_to_message_id: reply_to_id ?? undefined,
    reply_to: reply_to_id ? replyMap.get(reply_to_id) : undefined,
  };
}

// Strips reply_to when id is falsy — cleans up cache entries left by a previous bug
// where PostgREST returned [] for the self-referential join, producing {id: undefined, ...}
function stripInvalidReply(msg: MessageWithUsers): MessageWithUsers {
  if (msg.reply_to && !msg.reply_to.id) {
    return { ...msg, reply_to: undefined };
  }
  return msg;
}

// Helper to get current user ID from cached value (avoids getSession() deadlock)
function getCurrentUserId(): string | null {
  const userId = getCachedUserId();
  log('messages', 'getCurrentUserId:', userId);
  return userId;
}

// Fetch only users the current user is subscribed to (for recipient selection)
export async function fetchFollowedUsers(): Promise<User[]> {
  const currentUserId = getCurrentUserId();
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
    reportError(error, 'messages.fetchFollowedUsers');
    return [];
  }

  return data || [];
}

// Build conversations from a list of messages (with user joins)
function buildConversations(messages: RawMessageWithUsers[], currentUserId: string): Conversation[] {
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
          content_type: msg.content_type as MessageContentType,
          text_content: msg.text_content,
          created_at: msg.created_at,
          is_read: msg.is_read,
          is_from_me: isFromMe,
          deleted_by_sender: msg.deleted_by_sender,
          deleted_by_recipient: msg.deleted_by_recipient,
        },
        unreadCount,
      });
    }
  }

  return Array.from(conversationsMap.values());
}

// Fetch all conversations for current user (with local cache + incremental sync)
export async function fetchConversations(): Promise<Conversation[]> {
  log('messages', 'fetchConversations: START');
  const currentUserId = getCurrentUserId();
  log('messages', 'fetchConversations: currentUserId =', currentUserId);
  if (!currentUserId) {
    log('messages', 'fetchConversations: NO USER ID - returning empty');
    return [];
  }

  const cacheKey = CACHE_KEYS.CONVERSATIONS_MESSAGES;
  const lastSync = await getLastSyncTimestamp(cacheKey);
  const cachedMessages: RawMessageWithUsers[] = (await getCachedData<RawMessageWithUsers[]>(cacheKey)) || [];

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

  log('messages', 'fetchConversations: query done, error =', error, 'new count =', newMessages?.length, 'cached count =', cachedMessages.length);
  if (error) {
    reportError(error, 'messages.fetchConversations');
    if (cachedMessages.length > 0) {
      return buildConversations(cachedMessages, currentUserId);
    }
    return [];
  }

  // Merge: replace existing messages by id, add new ones
  const mergedMap = new Map<string, RawMessageWithUsers>();
  for (const msg of cachedMessages) {
    mergedMap.set(msg.id, msg);
  }
  for (const msg of (newMessages || []) as RawMessageWithUsers[]) {
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
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return null;

  const cachedMessages = await getCachedData<RawMessageWithUsers[]>(CACHE_KEYS.CONVERSATIONS_MESSAGES);
  if (!cachedMessages || cachedMessages.length === 0) return null;

  return buildConversations(cachedMessages, currentUserId);
}

// Fetch all messages for a specific conversation (with local cache + incremental sync)
export async function fetchConversationMessages(otherUserId: string): Promise<MessageWithUsers[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const cacheKey = CACHE_KEYS.CONVERSATION(otherUserId);
  const lastSync = await getLastSyncTimestamp(cacheKey);
  const cachedMessages: MessageWithUsers[] = ((await getCachedData<MessageWithUsers[]>(cacheKey)) || []).map(stripInvalidReply);

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (id, display_name, avatar_url),
      recipient:users!recipient_id (id, display_name, avatar_url),
      reply_to:messages!reply_to_id (id, content_type, text_content, media_url, deleted_by_sender, deleted_by_recipient, sender:users!sender_id (display_name))
    `)
    .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
    .order('created_at', { ascending: true });

  if (lastSync) {
    query = query.gt('created_at', lastSync);
  }

  const { data: newMessages, error } = await query;

  if (error) {
    reportError(error, 'messages.fetchConversationMessages');
    return cachedMessages.length > 0 ? cachedMessages : [];
  }

  // Merge by id
  const mergedMap = new Map<string, MessageWithUsers>();
  for (const msg of cachedMessages) {
    mergedMap.set(msg.id, msg);
  }
  // Collect reply_to_id values that need to be resolved
  const rawList = (newMessages || []) as RawMessageWithUsers[];
  const replyIds = [...new Set(rawList.map(m => m.reply_to_id).filter((id): id is string => !!id))];
  const replyMap = await fetchReplyMessages(replyIds);

  for (const raw of rawList) {
    mergedMap.set(raw.id, mapRawMessage(raw, replyMap));
  }

  // Sort by created_at ascending
  const allMessages = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Update cache (store all, including soft-deleted, so merge stays accurate)
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
  return cached.map(stripInvalidReply);
}

// Fetch messages for current user (as recipient)
export async function fetchMyMessages(): Promise<MessageWithSender[]> {
  const currentUserId = getCurrentUserId();
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
    reportError(error, 'messages.fetchMyMessages');
    return [];
  }

  return data || [];
}

// Fetch unread messages for map display
export async function fetchUnreadMessages(): Promise<MessageWithSender[]> {
  const currentUserId = getCurrentUserId();
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
    reportError(error, 'messages.fetchUnreadMessages');
    return [];
  }

  return data || [];
}

// Fetch read messages (inbox)
export async function fetchReadMessages(): Promise<MessageWithSender[]> {
  const currentUserId = getCurrentUserId();
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
    reportError(error, 'messages.fetchReadMessages');
    return [];
  }

  return data || [];
}

// Fetch only metadata for undiscovered messages (no content for security)
export async function fetchUndiscoveredMessagesMetadata(): Promise<UndiscoveredMessageMeta[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, created_at, is_read')
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) {
    reportError(error, 'messages.fetchUndiscoveredMessagesMetadata');
    return [];
  }

  return data || [];
}

// Fetch only location metadata for map markers (no content for security)
// Uses cache + incremental sync. Also removes messages that have been read.
export async function fetchUndiscoveredMessagesForMap(): Promise<UndiscoveredMessageMapMeta[]> {
  log('messages', 'fetchUndiscoveredMessagesForMap: START');
  const currentUserId = getCurrentUserId();
  log('messages', 'fetchUndiscoveredMessagesForMap: currentUserId =', currentUserId);
  if (!currentUserId) {
    log('messages', 'fetchUndiscoveredMessagesForMap: NO USER ID - returning empty');
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
      sender:users!sender_id (id, display_name, avatar_url, is_admin)
    `)
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .eq('deleted_by_recipient', false)
    .eq('deleted_by_sender', false)
    .order('created_at', { ascending: false });

  if (lastSync) {
    query = query.gt('created_at', lastSync);
  }

  const { data: newMessages, error } = await query;
  log('messages', 'fetchUndiscoveredMessagesForMap: query done, error =', error, 'new count =', newMessages?.length, 'cached count =', cachedMessages.length);

  if (error) {
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
    reportError(error, 'messages.fetchMessageById');
    return null;
  }

  return data;
}

// Fetch current user's public messages
export async function fetchMyPublicMessages(): Promise<Message[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*, discovered_public_messages(count)')
    .eq('sender_id', currentUserId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    reportError(error, 'messages.fetchMyPublicMessages');
    return [];
  }

  return (data || []).map((msg: any) => ({
    ...msg,
    discovery_count: msg.discovered_public_messages?.[0]?.count ?? 0,
    discovered_public_messages: undefined,
  }));
}

// Fetch public messages for a specific user (for UserProfileScreen)
export async function fetchUserPublicMessages(userId: string): Promise<Message[]> {
  log('messages', 'fetchUserPublicMessages: userId =', userId);

  const { data, error } = await supabase
    .from('messages')
    .select('*, discovered_public_messages(count)')
    .eq('sender_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  log('messages', 'fetchUserPublicMessages: data =', data?.length, 'error =', error);

  if (error) {
    reportError(error, 'messages.fetchUserPublicMessages');
    return [];
  }

  return (data || []).map((msg: any) => ({
    ...msg,
    discovery_count: msg.discovered_public_messages?.[0]?.count ?? 0,
    discovered_public_messages: undefined,
  }));
}

// Fetch public messages from all followed users (for map display)
export async function fetchFollowingPublicMessages(): Promise<UndiscoveredMessageMapMeta[]> {
  const currentUserId = getCurrentUserId();
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
    reportError(error, 'messages.fetchFollowingPublicMessages');
    return [];
  }

  const allMessages = (data || []) as unknown as UndiscoveredMessageMapMeta[];
  if (allMessages.length === 0) return [];

  // Filter out messages already discovered by the current user
  const { data: discoveredRows } = await supabase
    .from('discovered_public_messages')
    .select('message_id')
    .eq('user_id', currentUserId)
    .in('message_id', allMessages.map(m => m.id));

  const discoveredIds = new Set((discoveredRows || []).map(r => r.message_id));
  return allMessages.filter(m => !discoveredIds.has(m.id));
}

// Mark a public message as discovered by the current user
export async function markPublicMessageDiscovered(messageId: string): Promise<boolean> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;

  const { error } = await supabase
    .from('discovered_public_messages')
    .upsert({ user_id: currentUserId, message_id: messageId }, { onConflict: 'user_id,message_id' });

  if (error) {
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
    reportError(error, 'messages.fetchDiscoveredPublicMessageIds');
    return new Set();
  }

  return new Set((data || []).map(d => d.message_id));
}

// Fetch the current user's own sent flags with location (for map display in "mine" mode)
export async function fetchMyFlagsForMap(): Promise<OwnFlagMapMeta[]> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      location,
      created_at,
      is_public,
      is_read,
      is_admin_placed,
      content_type,
      text_content,
      media_url,
      recipient_id,
      recipient:users!recipient_id (id, display_name, avatar_url)
    `)
    .eq('sender_id', currentUserId)
    .eq('deleted_by_sender', false)
    .not('location', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    reportError(error, 'messages.fetchMyFlagsForMap');
    return [];
  }

  return (data || []) as unknown as OwnFlagMapMeta[];
}

// Send a new message (only to users the sender is subscribed to)
export async function sendMessage(
  recipientId: string | null,
  contentType: 'text' | 'photo' | 'audio',
  location: Coordinates | null,
  textContent?: string,
  mediaUrl?: string,
  isPublic?: boolean,
  replyToMessageId?: string | null,
  isAdminPlaced?: boolean
): Promise<Message | null> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return null;

  // Subscription check is handled by the database RLS policy on messages table
  log('messages', 'sendMessage:', { recipientId, contentType, hasText: !!textContent, hasMedia: !!mediaUrl, hasLocation: !!location, isPublic });

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
      is_admin_placed: isAdminPlaced || false,
      ...(replyToMessageId ? { reply_to_id: replyToMessageId } : {}),
    })
    .select()
    .single();

  if (error) {
    reportError(error, 'messages.sendMessage', { recipientId, contentType, isPublic });
    return null;
  }

  return data;
}

// Mark message as read and update local caches
export async function markMessageAsRead(messageId: string, senderId?: string): Promise<boolean> {
  const readAt = new Date().toISOString();

  const { error } = await supabase
    .from('messages')
    .update({
      is_read: true,
      read_at: readAt,
    })
    .eq('id', messageId);

  if (error) {
    reportError(error, 'messages.markMessageAsRead');
    return false;
  }

  // Remove from map messages cache (no longer undiscovered)
  const mapCached = await getCachedData<UndiscoveredMessageMapMeta[]>(CACHE_KEYS.MAP_MESSAGES);
  if (mapCached) {
    const updated = mapCached.filter(m => m.id !== messageId);
    await setCachedData(CACHE_KEYS.MAP_MESSAGES, updated);
  }

  // Update read status in global conversations cache
  const convCached = await getCachedData<RawMessageWithUsers[]>(CACHE_KEYS.CONVERSATIONS_MESSAGES);
  if (convCached) {
    const updated = convCached.map(m =>
      m.id === messageId ? { ...m, is_read: true, read_at: readAt } : m
    );
    await setCachedData(CACHE_KEYS.CONVERSATIONS_MESSAGES, updated);
  }

  // Update read status in per-conversation cache (used by ConversationScreen)
  if (senderId) {
    const perConvCached = await getCachedData<MessageWithUsers[]>(CACHE_KEYS.CONVERSATION(senderId));
    if (perConvCached) {
      const updated = perConvCached.map(m =>
        m.id === messageId ? { ...m, is_read: true, read_at: readAt } : m
      );
      await setCachedData(CACHE_KEYS.CONVERSATION(senderId), updated);
    }
  }

  return true;
}

// Soft-delete a message for the current user (sender or recipient)
export async function deleteMessage(messageId: string, otherUserId: string, isSender: boolean): Promise<boolean> {
  const field = isSender ? 'deleted_by_sender' : 'deleted_by_recipient';

  const { error } = await supabase
    .from('messages')
    .update({ [field]: true })
    .eq('id', messageId);

  if (error) {
    reportError(error, 'messages.deleteMessage');
    return false;
  }

  // Update per-conversation cache immediately so UI stays consistent
  const perConvCached = await getCachedData<MessageWithUsers[]>(CACHE_KEYS.CONVERSATION(otherUserId));
  if (perConvCached) {
    const updated = perConvCached.map((m) =>
      m.id === messageId ? { ...m, [field]: true } : m
    );
    await setCachedData(CACHE_KEYS.CONVERSATION(otherUserId), updated);
  }

  // Remove from map cache so the marker disappears immediately
  const mapCached = await getCachedData<UndiscoveredMessageMapMeta[]>(CACHE_KEYS.MAP_MESSAGES);
  if (mapCached) {
    await setCachedData(CACHE_KEYS.MAP_MESSAGES, mapCached.filter(m => m.id !== messageId));
  }

  return true;
}

// Upload media (photo or audio)
export async function uploadMedia(
  uri: string,
  type: 'photo' | 'audio'
): Promise<string | null> {
  try {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return null;

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
      reportError(error, 'messages.uploadMedia', { type });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (e) {
    reportError(e, 'messages.uploadMedia');
    return null;
  }
}

// -------------------------------------------------------------------
// User profile cache patching
// When a user's profile changes (avatar, display_name), we patch all
// cached messages that embed their data so the UI stays consistent
// without a full cache invalidation.
// -------------------------------------------------------------------

type UserProfileUpdates = {
  display_name?: string | null;
  avatar_url?: string | null;
};

function patchUserInMessages<T extends { sender?: { id: string } | null; recipient?: { id: string } | null }>(
  messages: T[],
  userId: string,
  updates: UserProfileUpdates
): T[] {
  return messages.map(msg => ({
    ...msg,
    sender: msg.sender?.id === userId ? { ...msg.sender, ...updates } : msg.sender,
    recipient: msg.recipient?.id === userId ? { ...msg.recipient, ...updates } : msg.recipient,
  }));
}

export async function patchUserInAllCaches(userId: string, updates: UserProfileUpdates): Promise<void> {
  // 1. Patch the conversations messages cache
  const convMsgs = await getCachedData<RawMessageWithUsers[]>(CACHE_KEYS.CONVERSATIONS_MESSAGES);
  if (convMsgs) {
    await setCachedData(CACHE_KEYS.CONVERSATIONS_MESSAGES, patchUserInMessages(convMsgs, userId, updates));
  }

  // 2. Patch all individual conversation caches (one per interlocutor)
  const convKeys = await getKeysWithPrefix('conversation_');
  for (const key of convKeys) {
    const msgs = await getCachedData<MessageWithUsers[]>(key);
    if (!msgs) continue;
    await setCachedData(key, patchUserInMessages(msgs, userId, updates));
  }
}

/**
 * Subscribe to profile changes on public.users via Supabase Realtime.
 * Automatically patches all local caches when a user updates their avatar or display name.
 * Returns a cleanup function — call it on logout or unmount.
 */
export function subscribeToUserProfileChanges(): () => void {
  const channel = supabase
    .channel('user-profile-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users' },
      (payload) => {
        const { id, display_name, avatar_url } = payload.new as {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        patchUserInAllCaches(id, { display_name, avatar_url }).catch((e) =>
          log('messages', 'patchUserInAllCaches error:', e)
        );
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
