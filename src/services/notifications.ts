import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Coordinates } from '@/types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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

// Get push token for remote notifications (future use)
export async function getPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
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
