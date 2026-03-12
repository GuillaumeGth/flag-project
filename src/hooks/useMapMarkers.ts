import { useState, useRef, useCallback } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';
import { isWithinRadius, calculateDistance } from '@/services/location';
import { log } from '@/utils/debug';

interface UseMapMarkersResult {
  avatarImages: Record<string, string>;
  avatarRefs: React.MutableRefObject<Record<string, View | null>>;
  captureAvatar: (messageId: string) => Promise<void>;
  clearAvatarImages: (ids: string[]) => void;
  canReadMessage: (messageLocation: Coordinates | null) => boolean;
  formatDistance: (messageLocation: Coordinates | null) => string | null;
}

export function useMapMarkers(
  userLocation: Coordinates | null,
  messages: UndiscoveredMessageMapMeta[]
): UseMapMarkersResult {
  const [avatarImages, setAvatarImages] = useState<Record<string, string>>({});
  const avatarImagesRef = useRef(avatarImages);
  avatarImagesRef.current = avatarImages;
  const avatarRefs = useRef<Record<string, View | null>>({});

  const clearAvatarImages = useCallback((ids: string[]) => {
    setAvatarImages(prev => {
      const updated = { ...prev };
      for (const id of ids) delete updated[id];
      return updated;
    });
  }, []);

  const captureAvatar = useCallback(async (messageId: string) => {
    const ref = avatarRefs.current[messageId];
    if (!ref || avatarImagesRef.current[messageId]) return;

    try {
      const uri = await captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      setAvatarImages(prev => ({ ...prev, [messageId]: uri }));
    } catch (e) {
      log('useMapMarkers', 'Failed to capture avatar:', e);
    }
  }, []);

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

  return { avatarImages, avatarRefs, captureAvatar, clearAvatarImages, canReadMessage, formatDistance };
}
