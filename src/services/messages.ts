import { supabase } from './supabase';
import { Message, MessageWithSender, Coordinates, UndiscoveredMessageMeta, UndiscoveredMessageMapMeta } from '@/types';

// Fetch messages for current user (as recipient)
export async function fetchMyMessages(): Promise<MessageWithSender[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

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
    .eq('recipient_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// Fetch unread messages for map display
export async function fetchUnreadMessages(): Promise<MessageWithSender[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

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
    .eq('recipient_id', userData.user.id)
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

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
    .eq('recipient_id', userData.user.id)
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, created_at, is_read')
    .eq('recipient_id', userData.user.id)
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, location, created_at')
    .eq('recipient_id', userData.user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

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
  location: Coordinates,
  textContent?: string,
  mediaUrl?: string
): Promise<Message | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: userData.user.id,
      recipient_id: recipientId,
      content_type: contentType,
      text_content: textContent,
      media_url: mediaUrl,
      location: `POINT(${location.longitude} ${location.latitude})`,
      radius: 30,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
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
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const ext = type === 'photo' ? 'jpg' : 'm4a';
  const fileName = `${userData.user.id}/${Date.now()}.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('media')
    .upload(fileName, blob, {
      contentType: type === 'photo' ? 'image/jpeg' : 'audio/m4a',
    });

  if (error) {
    console.error('Error uploading media:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
