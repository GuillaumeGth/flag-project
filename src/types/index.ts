// User type
export interface User {
  id: string;
  phone?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

// GPS Coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Message content types
export type MessageContentType = 'text' | 'photo' | 'audio';

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
