import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, shadows, radius } from '@/theme-redesign';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  withBorder?: boolean;
  withGlow?: boolean;
  glowColor?: 'violet' | 'cyan' | 'magenta';
}

const GLOW_COLORS = {
  violet: colors.glow.violet,
  cyan: colors.glow.cyan,
  magenta: colors.glow.magenta,
};

export default function GlassCard({
  children,
  style,
  intensity = 15,
  withBorder = true,
  withGlow = false,
  glowColor = 'violet',
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.container,
        withBorder && styles.border,
        withGlow && {
          ...shadows.glow,
          shadowColor: GLOW_COLORS[glowColor],
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
