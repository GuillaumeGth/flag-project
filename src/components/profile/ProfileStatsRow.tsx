import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme-redesign';

interface ProfileStatsRowProps {
  messagesCount: number;
  followerCount: number;
  locationsCount: number;
}

export default function ProfileStatsRow({
  messagesCount,
  followerCount,
  locationsCount,
}: ProfileStatsRowProps) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Ionicons name="images" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{messagesCount}</Text>
      </View>
      <View style={styles.statCard}>
        <Ionicons name="people" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{followerCount}</Text>
      </View>
      <View style={styles.statCard}>
        <Ionicons name="location" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{locationsCount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface.glass,
    borderRadius: radius.lg,
  },
  statNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
