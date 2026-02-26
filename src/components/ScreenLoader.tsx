import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme-redesign';

interface ScreenLoaderProps {
  message?: string;
}

export default function ScreenLoader({ message }: ScreenLoaderProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary.cyan} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  message: {
    marginTop: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },
});
