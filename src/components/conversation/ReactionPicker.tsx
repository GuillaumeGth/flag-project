import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ALLOWED_EMOJIS } from '@/services/reactions';
import { colors, radius, spacing, shadows } from '@/theme-redesign';

// Estimated pill height (38px emoji + vertical padding)
const PILL_HEIGHT = 54;
const PILL_MARGIN = 12;

interface ReactionPickerProps {
  visible: boolean;
  /** Emojis the current user has already reacted with on this message */
  currentReactions: readonly string[];
  /** pageY of the long-pressed message — pill will appear just above */
  anchorY?: number;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Module-level constants to avoid re-creation on every render
const SPRING_CONFIG = { damping: 18, stiffness: 250, mass: 0.8 } as const;
const TIMING_OPEN = { duration: 120 } as const;

export default function ReactionPicker({
  visible,
  currentReactions,
  anchorY,
  onSelect,
  onClose,
}: ReactionPickerProps) {
  const { height: screenHeight } = useWindowDimensions();
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, TIMING_OPEN);
    } else {
      scale.value = 0.7;
      opacity.value = 0;
    }
  }, [visible, scale, opacity]);

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  // Position pill above the long-pressed message, clamped within screen bounds
  const pillTop = anchorY != null
    ? Math.min(
        Math.max(PILL_MARGIN, anchorY - PILL_HEIGHT - PILL_MARGIN),
        screenHeight - PILL_HEIGHT - PILL_MARGIN
      )
    : screenHeight / 2 - PILL_HEIGHT;

  return (
    // pointerEvents="box-none" lets touches pass through the wrapper to elements below,
    // only the pill itself captures presses.
    <Animated.View
      style={[styles.wrapper, { top: pillTop }, animatedPillStyle]}
      pointerEvents="box-none"
    >
      <TouchableOpacity activeOpacity={1} style={styles.pill}>
        {ALLOWED_EMOJIS.map((emoji) => {
          const isActive = currentReactions.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.emojiButton, isActive && styles.emojiButtonActive]}
              onPress={() => {
                onSelect(emoji);
                onClose();
              }}
              activeOpacity={0.65}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glassDark,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    ...shadows.large,
  },
  emojiButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiButtonActive: {
    backgroundColor: 'rgba(124, 92, 252, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.6)',
  },
  emojiText: {
    fontSize: 22,
  },
});
