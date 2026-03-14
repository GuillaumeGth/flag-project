import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Coordinates } from '@/types';
import { reportError } from './errorReporting';

const LOCATION_TASK_NAME = 'background-location-task';

// Calculate distance between two points in meters (Haversine formula)
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // Earth's radius in meters
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check if user is within radius of a location
export function isWithinRadius(
  userLocation: Coordinates,
  targetLocation: Coordinates,
  radiusMeters: number = 100
): boolean {
  const distance = calculateDistance(userLocation, targetLocation);
  return distance <= radiusMeters;
}

// Request foreground location permission
export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

// Request background location permission
export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

// Get current location
export async function getCurrentLocation(): Promise<Coordinates | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    reportError(error, 'location.getCurrentLocation');
    return null;
  }
}

// Start background location tracking
export async function startBackgroundLocationTracking(): Promise<boolean> {
  const hasPermission = await requestBackgroundPermission();
  if (!hasPermission) return false;

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 10, // Update every 10 meters
      deferredUpdatesInterval: 1000, // Minimum time between updates
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Fläag',
        notificationBody: 'Recherche de messages autour de vous...',
        notificationColor: '#4A90D9',
      },
    });
    return true;
  } catch (error) {
    reportError(error, 'location.startBackgroundLocationTracking');
    return false;
  }
}

// Stop background location tracking
export async function stopBackgroundLocationTracking(): Promise<void> {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

// Watch foreground location changes
export async function watchForegroundLocation(
  onLocationUpdate: (coords: Coordinates) => void
): Promise<Location.LocationSubscription | null> {
  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
      },
      (location) => {
        onLocationUpdate({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );
    return subscription;
  } catch (error) {
    reportError(error, 'location.watchForegroundLocation');
    return null;
  }
}

// Export task name for TaskManager
export { LOCATION_TASK_NAME };
