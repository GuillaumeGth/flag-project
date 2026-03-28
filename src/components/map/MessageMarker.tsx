import React from 'react';
import { Image } from 'react-native';
import { Marker } from 'react-native-maps';
import { Coordinates } from '@/types';

interface MessageMarkerProps {
  markerId: string;
  location: Coordinates;
  avatarUri: string;
  isTarget: boolean;
  hasActiveRoute: boolean;
  onPress: () => void;
}

export default function MessageMarker({
  markerId,
  location,
  avatarUri,
  isTarget,
  hasActiveRoute,
  onPress,
}: MessageMarkerProps) {
  const opacity = hasActiveRoute && !isTarget ? 0.35 : 1;

  return (
    <Marker
      key={markerId}
      coordinate={location}
      image={{ uri: avatarUri }}
      anchor={{ x: 0.5, y: 0.9 }}
      onPress={onPress}
      opacity={opacity}
      tracksViewChanges={false}
    />
  );
}
