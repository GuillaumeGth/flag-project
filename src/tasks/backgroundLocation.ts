import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '@/services/supabase';
import { calculateDistance } from '@/services/location';
import { notifyNearbyMessage } from '@/services/notifications';
import { reportError } from '@/services/errorReporting';
import { Coordinates } from '@/types';

const LOCATION_TASK_NAME = 'background-location-task';
const PROXIMITY_RADIUS = 50; // Check at 50m to give time for notification

// Store notified message IDs to avoid duplicate notifications
const notifiedMessages = new Set<string>();

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
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
      }
    }
  } catch (error) {
    console.error('Error checking nearby messages:', error);
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
