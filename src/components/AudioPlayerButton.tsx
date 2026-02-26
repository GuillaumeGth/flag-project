import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme-redesign';

const SIZE_MAP = {
  small: 32,
  medium: 40,
  large: 56,
} as const;

const ICON_SIZE_MAP = {
  small: 16,
  medium: 20,
  large: 28,
} as const;

interface AudioPlayerButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}

export default function AudioPlayerButton({
  isPlaying,
  onPress,
  size = 'medium',
  style,
}: AudioPlayerButtonProps) {
  const buttonSize = SIZE_MAP[size];
  const iconSize = ICON_SIZE_MAP[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isPlaying ? 'pause' : 'play'}
        size={iconSize}
        color={colors.primary.cyan}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
