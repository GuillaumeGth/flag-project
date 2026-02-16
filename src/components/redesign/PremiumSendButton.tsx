/**
 * PremiumSendButton - Animated send button with haptic feedback
 * Sophisticated press animation with particle burst effect
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius } from '@/theme-redesign';

interface PremiumSendButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function PremiumSendButton({ onPress, disabled }: PremiumSendButtonProps) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glowScale = useSharedValue(1);

  // Idle breathing animation
  useEffect(() => {
    glowScale.value = withSequence(
      withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
    );

    const interval = setInterval(() => {
      glowScale.value = withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handlePress = () => {
    if (disabled) return;

    // Haptic feedback
    Vibration.vibrate(50);

    // Send animation
    scale.value = withSequence(
      withTiming(0.85, { duration: 100 }),
      withSpring(1.2, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 300 })
    );

    rotate.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(-10, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 10, stiffness: 300 })
    );

    onPress();
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowScale.value, [1, 1.1], [0.6, 0.8]);

    return {
      transform: [{ scale: glowScale.value }],
      opacity,
    };
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      disabled={disabled}
      style={styles.container}
    >
      {/* Glow effect */}
      <Animated.View style={[styles.glow, glowAnimatedStyle]} />

      {/* Button */}
      <Animated.View style={buttonAnimatedStyle}>
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary.cyan,
    ...shadows.glow,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
