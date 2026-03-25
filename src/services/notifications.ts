import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Coordinates } from '@/types';
import { supabase } from '@/services/supabase';
import { reportError } from '@/services/errorReporting';
import { log } from '@/utils/debug';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90D9',
    });
  }

  return true;
}

// Send local notification when near a message
export async function notifyNearbyMessage(
  messageId: string,
  senderName: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Message à proximité !',
      body: `${senderName} vous a laissé un message ici`,
      data: { messageId },
      sound: true,
      ...(Platform.OS === 'android' && {
        icon: 'ic_notification',
      }),
    },
    trigger: null, // Immediate
  });
}

// Get push token for remote notifications
export async function getPushToken(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    'c8cb48ce-1c64-4314-a6ad-ada1e82efca8';
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

// Register push token in database for the current user
export async function registerPushToken(userId: string): Promise<boolean> {
  try {
    // First request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return false;
    }

    // Get the push token
    const token = await getPushToken();
    if (!token) {
      return false;
    }

    // Upsert token in database and refresh last_used_at
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_name: Platform.OS,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,expo_push_token',
        }
      )
      .select();

    if (error) {
      reportError(error, 'notifications.registerPushToken');
      return false;
    }

    // Clean up tokens from this user that haven't been used in 30+ days
    // Fire-and-forget: a cleanup failure must not break the registration
    void Promise.resolve(supabase.rpc('cleanup_stale_push_tokens')).catch(() => {});

    return true;
  } catch (error) {
    reportError(error, 'notifications.registerPushToken');
    return false;
  }
}

// Unregister push token when user signs out
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    // Delete all tokens for this user to ensure clean sign-out,
    // even if getPushToken() would fail or return a different token.
    const { error } = await supabase
      .from('user_push_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      reportError(error, 'notifications.unregisterPushToken');
    } else {
      log('notifications', 'Push token unregistered successfully');
    }
  } catch (error) {
    reportError(error, 'notifications.unregisterPushToken');
  }
}

// Send local notification when near a public flag from a followed user
export async function notifyNearbyPublicFlag(
  messageId: string,
  senderName: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Fläag à proximité !',
      body: `${senderName} a posté un fläag près de vous`,
      data: { messageId },
      sound: true,
      ...(Platform.OS === 'android' && {
        icon: 'ic_notification',
      }),
    },
    trigger: null,
  });
}

// Add notification response listener
export function addNotificationResponseListener(
  callback: (messageId: string) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const messageId = response.notification.request.content.data?.messageId;
    if (messageId) {
      callback(messageId as string);
    }
  });
}
