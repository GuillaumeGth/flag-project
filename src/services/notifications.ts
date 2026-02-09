import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { Coordinates } from '@/types';
import { supabase } from '@/services/supabase';

// Debug log array to accumulate logs and show them all at once
let debugLogs: string[] = [];
function debugLog(msg: string) {
  console.log(`[PUSH DEBUG] ${msg}`);
  debugLogs.push(msg);
}
function showDebugLogs(title: string) {
  const logs = debugLogs.join('\n');
  debugLogs = [];
  Alert.alert(title, logs);
}

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
  debugLog(`Platform: ${Platform.OS}`);
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  debugLog(`Existing permission status: ${existingStatus}`);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    debugLog(`Requested permission, new status: ${finalStatus}`);
  }

  if (finalStatus !== 'granted') {
    debugLog('Permission NOT granted');
    return false;
  }

  debugLog('Permission granted');

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90D9',
    });
    debugLog('Android notification channel created');
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
  debugLog(`Constants.expoConfig: ${JSON.stringify(Constants.expoConfig?.extra?.eas)}`);
  debugLog(`Constants.easConfig: ${JSON.stringify((Constants as any).easConfig)}`);
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    'c8cb48ce-1c64-4314-a6ad-ada1e82efca8';
  debugLog(`projectId used: ${projectId}`);
  debugLog('Calling getExpoPushTokenAsync...');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  debugLog(`Token received: ${token.data}`);
  return token.data;
}

// Register push token in database for the current user
export async function registerPushToken(userId: string): Promise<boolean> {
  debugLogs = [];
  try {
    debugLog(`registerPushToken START for userId: ${userId}`);

    // First request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      debugLog('FAILED: permission not granted');
      showDebugLogs('Push ECHEC - Permission');
      return false;
    }

    // Get the push token
    debugLog('Getting push token...');
    const token = await getPushToken();
    debugLog(`getPushToken returned: ${token}`);
    if (!token) {
      debugLog('FAILED: token is null');
      showDebugLogs('Push ECHEC - Token null');
      return false;
    }

    // Upsert token in database
    debugLog('Upserting token in DB...');
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
      debugLog(`FAILED upsert: ${error.message} | ${error.hint || ''}`);
      showDebugLogs('Push ECHEC - DB');
      return false;
    }

    debugLog(`SUCCESS! Rows: ${data?.length}`);
    showDebugLogs('Push OK');
    return true;
  } catch (error: any) {
    debugLog(`EXCEPTION: ${error?.message || error}`);
    debugLog(`Stack: ${error?.stack || 'N/A'}`);
    showDebugLogs('Push EXCEPTION');
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
