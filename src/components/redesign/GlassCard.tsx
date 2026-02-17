import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, shadows, radius } from '@/theme-redesign';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  withBorder?: boolean;
  withGlow?: boolean;
  glowColor?: 'violet' | 'cyan' | 'magenta';
}

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
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface.glass,
  },
  content: {
    padding: 16,
  },
  border: {
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
});
