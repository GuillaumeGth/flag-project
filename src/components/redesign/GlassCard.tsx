import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, shadows, radius } from '@/theme-redesign';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  withBorder?: boolean;
  withGlow?: boolean;
  glowColor?: 'violet' | 'cyan' | 'magenta';
}

/**
 * Premium Glass Card with Glassmorphism Effect
 * Usage: Wrap content in this for elevated, glass-like surfaces
 */
export default function GlassCard({
  children,
  style,
  intensity = 15,
  withBorder = true,
  withGlow = false,
  glowColor = 'violet',
}: GlassCardProps) {
  const glowColors = {
    violet: colors.glow.violet,
    cyan: colors.glow.cyan,
    magenta: colors.glow.magenta,
  };

  return (
    <View
      style={[
        styles.container,
        withBorder && styles.border,
        withGlow && {
          ...shadows.glow,
          shadowColor: glowColors[glowColor],
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint="default" style={styles.blur}>
        <View style={styles.content}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface.glass,
  },
  blur: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  border: {
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
});
