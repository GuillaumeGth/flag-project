import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '@/theme-redesign';

interface PremiumAvatarProps {
  uri?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  withGlow?: boolean;
  glowColor?: 'violet' | 'cyan' | 'magenta';
  withRing?: boolean;
  ringColor?: 'gradient' | 'cyan' | 'violet';
  style?: ViewStyle;
  isBot?: boolean;
}

const AVATAR_SIZES = {
  small: 32,
  medium: 48,
  large: 64,
  xlarge: 96,
};

const GLOW_COLORS = {
  violet: colors.glow.violet,
  cyan: colors.glow.cyan,
  magenta: colors.glow.magenta,
};

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Premium Avatar with optional glow and gradient ring
 */
export default function PremiumAvatar({
  uri,
  name,
  size = 'medium',
  withGlow = false,
  glowColor = 'violet',
  withRing = false,
  ringColor = 'gradient',
  style,
  isBot = false,
}: PremiumAvatarProps) {
  const containerSize = AVATAR_SIZES[size];
  const avatarSize = withRing ? containerSize - 6 : containerSize;
  const ringSize = containerSize + 4;

  const renderAvatar = () => (
    <View
      style={[
        styles.avatar,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
        },
        withGlow && {
          ...shadows.glow,
          shadowColor: GLOW_COLORS[glowColor],
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          }}
        />
      ) : isBot ? (
        <View style={[styles.placeholder, { backgroundColor: colors.primary.cyan }]}>
          <Ionicons name="flag" size={avatarSize * 0.5} color="#fff" />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text
            style={[
              styles.initials,
              { fontSize: avatarSize * 0.35 },
            ]}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );

  if (withRing) {
    return (
      <View style={[{ width: containerSize, height: containerSize }, style]}>
        {ringColor === 'gradient' ? (
          <LinearGradient
            colors={colors.gradients.primary}
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
              },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.ringInner}>{renderAvatar()}</View>
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderColor: ringColor === 'cyan' ? colors.primary.cyan : colors.primary.violet,
              },
            ]}
          >
            <View style={styles.ringInner}>{renderAvatar()}</View>
          </View>
        )}
      </View>
    );
  }

  return <View style={style}>{renderAvatar()}</View>;
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    backgroundColor: colors.surface.elevated,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.primary.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  ring: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  ringInner: {
    backgroundColor: colors.background.primary,
    borderRadius: 9999,
    padding: 3,
  },
});
