/**
 * ShimmerEffect - Animated shimmer overlay for premium feel
 * Creates a subtle light sweep effect across components
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerEffectProps {
  width: number;
  height: number;
  colors?: string[];
  duration?: number;
}

export default function ShimmerEffect({
  width,
  height,
  colors = ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0)'],
  duration = 3000,
}: ShimmerEffectProps) {
  const translateX = useSharedValue(-width);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width * 2, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [width, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.shimmerContainer,
        {
          width: width * 2,
          height,
        },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shimmerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  gradient: {
    flex: 1,
    transform: [{ skewX: '-20deg' }],
  },
});
