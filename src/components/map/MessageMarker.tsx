import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Coordinates } from '@/types';
import { colors, radius } from '@/theme-redesign';

interface MessageMarkerProps {
  markerId: string;
  location: Coordinates;
  avatarUrl: string;
  isPublic: boolean;
  count: number;
  isTarget: boolean;
  hasActiveRoute: boolean;
  onPress: () => void;
}

export default function MessageMarker({
  markerId,
  location,
  avatarUrl,
  isPublic,
  count,
  isTarget,
  hasActiveRoute,
  onPress,
}: MessageMarkerProps) {
  const opacity = hasActiveRoute && !isTarget ? 0.35 : 1;

  return (
    <Marker
      key={markerId}
      coordinate={location}
      anchor={{ x: 0.5, y: 0.9 }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[styles.wrapper, { opacity }]}>
        <View style={[styles.avatar, isPublic && styles.avatarPublic]}>
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        </View>
        {count > 1 && (
          <LinearGradient
            colors={colors.gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{count}</Text>
          </LinearGradient>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarPublic: {
    borderWidth: 3,
    borderColor: colors.primary.violet,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
});
