import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, typography, radius } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumButton from '@/components/redesign/PremiumButton';

// Module-level animation constants
const PULSE_DURATION = 1800;
const PULSE_MIN = 0.92;
const PULSE_MAX = 1.08;

const BIRTHDAY_GRADIENT: readonly [string, string, string, string] = [
  '#0D0A1A',
  '#1A0D2E',
  '#0D1A2E',
  '#0A0D1A',
];

interface BirthdayScreenProps {
  onComplete: () => void;
}

export default function BirthdayScreen({ onComplete }: BirthdayScreenProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(PULSE_MAX, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.sin) }),
        withTiming(PULSE_MIN, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    rotate.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, [scale, rotate]);

  const cakeAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <LinearGradient
      colors={BIRTHDAY_GRADIENT}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Stars decoration */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.starsRow}>
        <Text style={styles.starSmall}>✨</Text>
        <Text style={styles.starLarge}>⭐</Text>
        <Text style={styles.starSmall}>✨</Text>
        <Text style={styles.starLarge}>⭐</Text>
        <Text style={styles.starSmall}>✨</Text>
      </Animated.View>

      {/* Birthday cake hero */}
      <Animated.View style={[styles.cakeContainer, cakeAnimStyle]}>
        <LinearGradient
          colors={['rgba(255,215,0,0.18)', 'rgba(255,180,0,0.08)', 'rgba(255,215,0,0.04)']}
          style={styles.cakeGlow}
        >
          <Text style={styles.cakeEmoji}>🎂</Text>
        </LinearGradient>
      </Animated.View>

      {/* Message card */}
      <Animated.View
        entering={FadeInDown.delay(300).springify().damping(14).stiffness(100)}
        style={styles.cardWrapper}
      >
        <GlassCard style={styles.card} withGlow glowColor="violet">
          <Text style={styles.title}>Joyeux anniversaire 🎉</Text>
          <Text style={styles.message}>
            Aujourd&apos;hui est un jour un peu spécial me semble t-il.{'\n\n'}
            Des Flāags d&apos;anniversaire ont pu se cacher autour de toi pendant la nuit,
            ouvre vite ta carte — l&apos;aventure commence.
          </Text>
        </GlassCard>
      </Animated.View>

      {/* Bottom confetti + CTA */}
      <Animated.View
        entering={FadeInDown.delay(500).springify()}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
      >
        <View style={styles.confettiRow}>
          <Text style={styles.confetti}>🎊</Text>
          <Text style={styles.confetti}>🎈</Text>
          <Text style={styles.confetti}>🎊</Text>
        </View>
        <PremiumButton
          title="Ouvrir la carte"
          onPress={onComplete}
          variant="gradient"
          size="large"
          fullWidth
          withGlow
        />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xl,
    opacity: 0.8,
  },
  starSmall: {
    fontSize: 18,
  },
  starLarge: {
    fontSize: 24,
  },
  cakeContainer: {
    marginVertical: spacing.xl,
  },
  cakeGlow: {
    width: 160,
    height: 160,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  cakeEmoji: {
    fontSize: 88,
  },
  cardWrapper: {
    width: '100%',
    paddingHorizontal: spacing.xxl,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: '700',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: typography.sizes.xxxl * 1.2,
  },
  message: {
    fontSize: typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: typography.sizes.md * 1.7,
  },
  footer: {
    width: '100%',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  confettiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  confetti: {
    fontSize: 28,
  },
});
