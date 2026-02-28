import { Coordinates } from './index';

export type ToastParams = {
  message: string;
  type: 'success' | 'warning' | 'error';
};

// Root stack — screens outside the tab navigator
export type RootStackParamList = {
  Auth: undefined;
  Main: { screen: keyof MainTabParamList; params?: object } | undefined;
  Conversation: { otherUserId: string; otherUserName: string; otherUserAvatarUrl?: string };
  CreateMessage: {
    recipientId?: string;
    recipientName?: string;
    recipients?: { id: string; name: string }[];
  } | undefined;
  ReadMessage: { messageId: string };
  SelectRecipient: undefined;
  UserProfile: { userId: string };
  Settings: undefined;
};

// Bottom tab navigator screens
export type MainTabParamList = {
  Map: { messageId?: string; focusLocation?: Coordinates; toast?: ToastParams; refresh?: number } | undefined;
  Inbox: undefined;
  Search: undefined;
  Profile: undefined;
};
