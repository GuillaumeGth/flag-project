// User type
export interface User {
  id: string;
  phone?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  is_admin?: boolean;
}

// GPS Coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Message content types
export type MessageContentType = 'text' | 'photo' | 'audio';

// Quoted message data embedded inside a reply (shape returned by Supabase join)
export interface MessageReply {
  id: string;
  content_type: MessageContentType;
  text_content?: string;
  media_url?: string;
  deleted_by_sender?: boolean;
  deleted_by_recipient?: boolean;
  sender?: { display_name?: string } | null;
}

// Message type
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content_type: MessageContentType;
  text_content?: string;
  media_url?: string;
  location: Coordinates;
  created_at: string;
  read_at?: string;
  is_read: boolean;
  is_public?: boolean;
  deleted_by_sender?: boolean;
  deleted_by_recipient?: boolean;
  reply_to_message_id?: string | null;
  reply_to?: MessageReply | null;
}

// Message with sender info for display
export interface MessageWithSender extends Message {
  sender: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

// Metadata only for undiscovered messages (no content for security)
export interface UndiscoveredMessageMeta {
  id: string;
  created_at: string;
  is_read: boolean;
}

// Metadata for map markers (no content for security)
export interface UndiscoveredMessageMapMeta {
  id: string;
  location: string | Coordinates; // PostGIS POINT or Coordinates
  created_at: string;
  is_public?: boolean;
  sender?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

// Metadata for the current user's own sent flags on the map
export interface OwnFlagMapMeta {
  id: string;
  location: string | Coordinates;
  created_at: string;
  is_public: boolean;
  content_type: MessageContentType;
  text_content?: string | null;
  media_url?: string | null;
  recipient_id: string | null;
  recipient?: Pick<User, 'id' | 'display_name' | 'avatar_url'> | null;
}

// For map markers
export interface MapMarker {
  id: string;
  coordinate: Coordinates;
  is_readable: boolean; // within 100m radius
  sender_name?: string;
}

// Conversation type for inbox display
export interface Conversation {
  id: string; // other user's id
  otherUser: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  lastMessage: {
    id: string;
    content_type: MessageContentType;
    text_content?: string;
    created_at: string;
    is_read: boolean;
    is_from_me: boolean;
  };
  unreadCount: number;
}

// Message with both sender and recipient info
export interface MessageWithUsers extends Message {
  sender: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  recipient: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

// Auth state
export interface AuthState {
  user: User | null;
  session: import('@supabase/supabase-js').Session | null;
  loading: boolean;
}

export * from './navigation';
export * from './reactions';

// Location state
export interface LocationState {
  current: Coordinates | null;
  permission: 'granted' | 'denied' | 'undetermined';
  loading: boolean;
}
