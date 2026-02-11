import { supabase, getCachedUserId } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Message, MessageWithSender, Coordinates, User, UndiscoveredMessageMeta, UndiscoveredMessageMapMeta, Conversation, MessageWithUsers } from '@/types';

// Default Flag Bot user ID (created via seed.sql)
export const FLAG_BOT_ID = '00000000-0000-0000-0000-000000000001';

// Helper to get current user ID from cached value (avoids getSession() deadlock)
function getCurrentUserId(): string | null {
  const userId = getCachedUserId();
  console.log('[messages] getCurrentUserId:', userId);
  return userId;
}

// Fetch all users (for recipient selection)
export async function fetchAllUsers(): Promise<User[]> {
  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  // Filter out current user
  return (data || []).filter(user => user.id !== currentUserId);
}

// Fetch all conversations for current user
export async function fetchConversations(): Promise<Conversation[]> {
  console.log('[messages] fetchConversations: START');
  const currentUserId = await getCurrentUserId();
  console.log('[messages] fetchConversations: currentUserId =', currentUserId);
  if (!currentUserId) {
    console.log('[messages] fetchConversations: NO USER ID - returning empty');
    return [];
  }

  // Fetch all messages where user is sender or recipient
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (id, display_name, avatar_url),
      recipient:users!recipient_id (id, display_name, avatar_url)
    `)
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  console.log('[messages] fetchConversations: query done, error =', error, 'count =', messages?.length);
  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  // Group messages by conversation (other user)
  const conversationsMap = new Map<string, Conversation>();

  for (const msg of messages || []) {
    const isFromMe = msg.sender_id === currentUserId;
    const otherUserId = isFromMe ? msg.recipient_id : msg.sender_id;
    const otherUser = isFromMe ? msg.recipient : msg.sender;

    // Skip if other user data is missing (user might have been deleted)
    if (!otherUser || !otherUserId) {
      console.warn('Skipping message with missing user data:', msg.id);
      continue;
    }

    if (!conversationsMap.has(otherUserId)) {
      // Count unread messages from this user
      const unreadCount = (messages || []).filter(
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

// Fetch all messages for a specific conversation
export async function fetchConversationMessages(otherUserId: string): Promise<MessageWithUsers[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id (id, display_name, avatar_url),
      recipient:users!recipient_id (id, display_name, avatar_url)
    `)
    .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation messages:', error);
    return [];
  }

  return data || [];
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
    return [];
  }

  return data || [];
}

// Fetch only location metadata for map markers (no content for security)
export async function fetchUndiscoveredMessagesForMap(): Promise<UndiscoveredMessageMapMeta[]> {
  console.log('[messages] fetchUndiscoveredMessagesForMap: START');
  const currentUserId = await getCurrentUserId();
  console.log('[messages] fetchUndiscoveredMessagesForMap: currentUserId =', currentUserId);
  if (!currentUserId) {
    console.log('[messages] fetchUndiscoveredMessagesForMap: NO USER ID - returning empty');
    return [];
  }

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      location,
      created_at,
      sender:users!sender_id (id, display_name, avatar_url)
    `)
    .eq('recipient_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  console.log('[messages] fetchUndiscoveredMessagesForMap: query done, error =', error, 'count =', data?.length);

  if (error) {
    console.error('Error fetching undiscovered messages for map:', error);
    return [];
  }

  return data || [];
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
    return null;
  }

  return data;
}

// Send a new message
export async function sendMessage(
  recipientId: string,
  contentType: 'text' | 'photo' | 'audio',
  location: Coordinates | null,
  textContent?: string,
  mediaUrl?: string
): Promise<Message | null> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    console.error('sendMessage: No authenticated user');
    return null;
  }

  console.log('sendMessage:', { recipientId, contentType, hasText: !!textContent, hasMedia: !!mediaUrl, hasLocation: !!location });

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: currentUserId,
      recipient_id: recipientId,
      content_type: contentType,
      text_content: textContent,
      media_url: mediaUrl,
      location: location ? `POINT(${location.longitude} ${location.latitude})` : null,
      radius: location ? 60 : null,
      is_read: location ? false : true, // Messages without location are immediately readable
    })
    .select()
    .single();

  if (error) {
    console.error('sendMessage error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    return null;
  }

  return data;
}

// Mark message as read
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (error) {
    console.error('Error marking message as read:', error);
    return false;
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
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (e) {
    console.error('Exception during media upload:', e);
    return null;
  }
}
