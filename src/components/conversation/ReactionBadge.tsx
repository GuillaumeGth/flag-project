import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ReactionSummary } from '@/types/reactions';
import { colors, radius, spacing, typography } from '@/theme-redesign';

interface ReactionBadgeProps {
  reaction: ReactionSummary;
  onPress: () => void;
}

export default function ReactionBadge({ reaction, onPress }: ReactionBadgeProps) {
  return (
    <TouchableOpacity
      style={[styles.badge, reaction.has_reacted && styles.badgeActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{reaction.emoji}</Text>
      {reaction.count > 1 && (
        <Text style={[styles.count, reaction.has_reacted && styles.countActive]}>
          {reaction.count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glassDark,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.2)',
  },
  badgeActive: {
    backgroundColor: 'rgba(124, 92, 252, 0.25)',
    borderColor: 'rgba(124, 92, 252, 0.6)',
  },
  emoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  count: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  countActive: {
    color: colors.primary.violet,
  },
});
