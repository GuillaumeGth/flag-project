import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography, shadows } from '@/theme-redesign';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses a destructive (red) gradient */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.8 } as const;
const TIMING_FADE = { duration: 200 } as const;

const DESTRUCTIVE_GRADIENT = ['#FF5C7C', '#E0305A'] as const;

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, TIMING_FADE);
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, TIMING_FADE);
    } else {
      backdropOpacity.value = withTiming(0, TIMING_FADE);
      scale.value = withTiming(0.85, TIMING_FADE);
      opacity.value = withTiming(0, TIMING_FADE);
    }
  }, [visible, scale, opacity, backdropOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.backdropDim]} />
      </Animated.View>

      {/* Dismiss on backdrop tap */}
      <Pressable style={styles.pressableArea} onPress={onCancel} />

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Subtle top border glow */}
          <View style={styles.topGlow} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {/* Cancel — ghost */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </TouchableOpacity>

            {/* Confirm — gradient */}
            <TouchableOpacity
              style={styles.confirmButtonWrapper}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={destructive ? DESTRUCTIVE_GRADIENT : colors.gradients.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 0,
  },
  backdropDim: {
    backgroundColor: 'rgba(5, 5, 12, 0.55)',
  },
  pressableArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    zIndex: 2,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
    padding: spacing.xxl,
    overflow: 'hidden',
    ...shadows.large,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.6)',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  confirmButtonWrapper: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  confirmButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  confirmLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
