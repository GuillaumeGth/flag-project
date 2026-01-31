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
  radius: number; // meters (default 30)
  created_at: string;
  read_at?: string;
  is_read: boolean;
}

// Message with sender info for display
export interface MessageWithSender extends Message {
  sender: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

// For map markers
export interface MapMarker {
  id: string;
  coordinate: Coordinates;
  is_readable: boolean; // within 30m radius
  sender_name?: string;
}

// Auth state
export interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
}

// Location state
export interface LocationState {
  current: Coordinates | null;
  permission: 'granted' | 'denied' | 'undetermined';
  loading: boolean;
}
