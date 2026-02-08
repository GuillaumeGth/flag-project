import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { Coordinates } from '@/types';
import { supabase } from '@/services/supabase';

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
    },
    trigger: null, // Immediate
  });
}

// Get push token for remote notifications
export async function getPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('Project ID from config:', projectId);
    if (!projectId) {
      console.error('No projectId found in app.json - check extra.eas.projectId');
      return null;
    }
    console.log('Requesting Expo push token...');
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Expo push token received:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error getting push token (this fails on Expo Go - use dev build):', error);
    return null;
  }
}

// Register push token in database for the current user
export async function registerPushToken(userId: string): Promise<boolean> {
  try {
    // First request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      Alert.alert('Push Debug', 'Permission notifications refusée');
      return false;
    }

    // Get the push token
    const token = await getPushToken();
    if (!token) {
      Alert.alert('Push Debug', 'Impossible d\'obtenir le push token');
      return false;
    }

    // Upsert token in database (handles duplicates via unique constraint)
    const { data, error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_name: Platform.OS,
        },
        {
          onConflict: 'user_id,expo_push_token',
        }
      )
      .select();

    if (error) {
      Alert.alert('Push Debug', `Erreur upsert: ${error.message}\n${error.hint || ''}`);
      return false;
    }

    Alert.alert('Push Debug', `Token enregistré ! Rows: ${data?.length}`);
    return true;
  } catch (error) {
    Alert.alert('Push Debug', `Exception: ${error}`);
    return false;
  }
}

// Unregister push token when user signs out
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const token = await getPushToken();
    if (!token) return;

    const { error } = await supabase
      .from('user_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', token);

    if (error) {
      console.error('Error unregistering push token:', error);
    } else {
      console.log('Push token unregistered successfully');
    }
  } catch (error) {
    console.error('Error in unregisterPushToken:', error);
  }
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
