import React from 'react';
import { Image } from 'react-native';
import { Marker } from 'react-native-maps';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';

interface MessageMarkerProps {
  message: UndiscoveredMessageMapMeta;
  location: Coordinates;
  avatarUri: string;
  isTarget: boolean;
  hasActiveRoute: boolean;
  onPress: (message: UndiscoveredMessageMapMeta) => void;
}

export default function MessageMarker({
  message,
  location,
  avatarUri,
  isTarget,
  hasActiveRoute,
  onPress,
}: MessageMarkerProps) {
  const opacity = hasActiveRoute && !isTarget ? 0.35 : 1;

  return (
    <Marker
      key={message.id}
      coordinate={location}
      image={{ uri: avatarUri }}
      onPress={() => onPress(message)}
      opacity={opacity}
    />
  );
}
