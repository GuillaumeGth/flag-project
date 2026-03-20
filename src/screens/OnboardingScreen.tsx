import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ListRenderItem,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography, radius } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumButton from '@/components/redesign/PremiumButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'map',
    title: 'Explore le monde autour de toi',
    description:
      'Des messages sont cachés dans le monde réel. Approche-toi à moins de 100m pour les découvrir et les lire.',
  },
  {
    id: '2',
    icon: 'location',
    title: 'Plante un flag',
    description:
      "Laisse un message ancré à l'endroit où tu te trouves. Ta position GPS est captée automatiquement par ton téléphone.",
  },
  {
    id: '3',
    icon: 'chatbubbles',
    title: 'Conversations privées',
    description:
      "Échange en direct avec les autres explorateurs. Les messages du chat ne sont pas géolocalisés — tu peux écrire depuis n'importe où.",
  },
  {
    id: '4',
    icon: 'people',
    title: 'Suis des explorateurs',
    description:
      'Abonne-toi à des utilisateurs pour voir leurs flags publics et créer des échanges.',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const goToNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderSlide: ListRenderItem<Slide> = ({ item }) => (
    <View style={styles.slide}>
      <Animated.View
        entering={FadeInDown.springify().damping(14).stiffness(120)}
        style={styles.iconContainer}
      >
        <Ionicons name={item.icon} size={72} color={colors.primary.violet} />
      </Animated.View>

      <GlassCard style={styles.card} withGlow glowColor="violet">
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </GlassCard>
    </View>
  );

  return (
    <LinearGradient
      colors={colors.gradients.subtle}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Skip button */}
      <View style={styles.header}>
        {!isLastSlide && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        style={styles.flatList}
      />

      {/* Bottom actions */}
      <View style={styles.footer}>
        <PremiumButton
          title={isLastSlide ? 'Commencer' : 'Suivant'}
          onPress={goToNext}
          variant="gradient"
          size="large"
          fullWidth
          withGlow={isLastSlide}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    height: 48,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    color: colors.text.tertiary,
    fontSize: typography.sizes.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary.violet,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconContainer: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  card: {
    width: '100%',
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.sizes.xxxl * 1.2,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.sizes.md * 1.6,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
});
