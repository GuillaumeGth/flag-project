import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { calculateDistance } from '@/services/location';
import { notifyNearbyMessage } from '@/services/notifications';
import { reportError } from '@/services/errorReporting';
import { Coordinates } from '@/types';

const LOCATION_TASK_NAME = 'background-location-task';
const PROXIMITY_RADIUS = 300; // Notify at 300m to give time before reaching message
const NOTIFIED_MESSAGES_KEY = '@flagapp/notified_proximity_messages';

async function loadNotifiedMessages(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFIED_MESSAGES_KEY);
    if (stored) {
      return new Set(JSON.parse(stored) as string[]);
    }
  } catch {}
  return new Set();
}

async function saveNotifiedMessages(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFIED_MESSAGES_KEY, JSON.stringify([...ids]));
  } catch {}
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    reportError(error, 'backgroundLocation.task');
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      const userCoords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      await checkNearbyMessages(userCoords);
    }
  }
});

async function checkNearbyMessages(userLocation: Coordinates) {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Fetch unread messages for this user
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, location, sender_id, users!sender_id(display_name)')
      .eq('recipient_id', userData.user.id)
      .eq('is_read', false);

    if (error || !messages) return;

    // Load persisted notified message IDs
    const notifiedMessages = await loadNotifiedMessages();

    // Prune IDs that are no longer in the unread list (already read or deleted)
    const unreadIds = new Set(messages.map((m) => m.id));
    let changed = false;
    for (const id of notifiedMessages) {
      if (!unreadIds.has(id)) {
        notifiedMessages.delete(id);
        changed = true;
      }
    }

    for (const message of messages) {
      // Skip if already notified
      if (notifiedMessages.has(message.id)) continue;

      // Parse location
      const msgLocation = parseLocation(message.location);
      if (!msgLocation) continue;

      // Check distance
      const distance = calculateDistance(userLocation, msgLocation);

      if (distance <= PROXIMITY_RADIUS) {
        // Send notification
        const senderName = (message as any).users?.display_name || 'Quelqu\'un';
        await notifyNearbyMessage(message.id, senderName);
        notifiedMessages.add(message.id);
        changed = true;
      }
    }

    if (changed) {
      await saveNotifiedMessages(notifiedMessages);
    }
  } catch (error) {
    reportError(error, 'backgroundLocation.checkNearbyMessages');
  }
}

function parseLocation(location: any): Coordinates | null {
  if (!location) return null;

  // Handle PostGIS POINT format
  if (typeof location === 'string') {
    const match = location.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (match) {
      return {
        longitude: parseFloat(match[1]),
        latitude: parseFloat(match[2]),
      };
    }
  }

  // Handle object format
  if (location.latitude && location.longitude) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  return null;
}

export { LOCATION_TASK_NAME };
