import { Coordinates } from './index';

export type ToastParams = {
  message: string;
  type: 'success' | 'warning' | 'error';
};

// Root stack — screens outside the tab navigator
export type RootStackParamList = {
  Auth: undefined;
  Main: { screen: keyof MainTabParamList; params?: object } | undefined;
  Conversation: { otherUserId: string; otherUserName: string; otherUserAvatarUrl?: string; scrollToMessageId?: string };
  CreateMessage: { adminLocation?: Coordinates } | undefined;
  SendMessage: {
    contentType?: import('./index').MessageContentType;
    textContent?: string;
    mediaUri?: string;
    adminLocation?: Coordinates;
    recipients?: { id: string; name: string }[];
  } | undefined;
  ReadMessage: { messageId: string };
  SelectRecipient: { mode: 'chat' | 'flag' };
  UserProfile: { userId: string };
  MessageFeed: { userId: string; initialMessageId: string };
  Settings: undefined;
  Contact: undefined;
  Privacy: undefined;
  FollowRequests: undefined;
};

// Bottom tab navigator screens
export type MainTabParamList = {
  Map: { messageId?: string; focusLocation?: Coordinates; toast?: ToastParams; refresh?: number; mine?: boolean } | undefined;
  Inbox: undefined;
  Search: undefined;
  Profile: undefined;
};
