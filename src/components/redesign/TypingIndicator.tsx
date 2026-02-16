/**
 * TypingIndicator - Animated dots showing someone is typing
 * Premium animation with wave effect
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius } from '@/theme-redesign';

interface TypingIndicatorProps {
  dotColor?: string;
  size?: number;
}

export default function TypingIndicator({
  dotColor = colors.primary.cyan,
  size = 8,
}: TypingIndicatorProps) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animation = (value: Animated.SharedValue<number>, delay: number) => {
      value.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      );
    };

    animation(dot1, 0);
    animation(dot2, 150);
    animation(dot3, 300);
  }, []);

  const createDotStyle = (value: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: value.value }],
      opacity: 0.4 + Math.abs(value.value) / 4,
    }));

  const dot1Style = createDotStyle(dot1);
  const dot2Style = createDotStyle(dot2);
  const dot3Style = createDotStyle(dot3);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { width: size, height: size, backgroundColor: dotColor }, dot1Style]} />
      <Animated.View style={[styles.dot, { width: size, height: size, backgroundColor: dotColor }, dot2Style]} />
      <Animated.View style={[styles.dot, { width: size, height: size, backgroundColor: dotColor }, dot3Style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.lg,
    maxWidth: 80,
  },
  dot: {
    borderRadius: radius.full,
  },
});
