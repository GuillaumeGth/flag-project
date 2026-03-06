import { useCallback } from 'react';
import { Coordinates } from '@/types';
import { isWithinRadius, calculateDistance } from '@/services/location';

interface UseMapMarkersResult {
  canReadMessage: (messageLocation: Coordinates | null) => boolean;
  formatDistance: (messageLocation: Coordinates | null) => string | null;
}

export function useMapMarkers(userLocation: Coordinates | null): UseMapMarkersResult {
  const canReadMessage = useCallback((messageLocation: Coordinates | null): boolean => {
    if (!userLocation || !messageLocation) return false;
    return isWithinRadius(userLocation, messageLocation, 100);
  }, [userLocation]);

  const formatDistance = useCallback((messageLocation: Coordinates | null): string | null => {
    if (!userLocation || !messageLocation) return null;
    const distance = calculateDistance(userLocation, messageLocation);
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  }, [userLocation]);

  return { canReadMessage, formatDistance };
}
