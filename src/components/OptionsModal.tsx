import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme-redesign';

export interface OptionsModalOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface OptionsModalProps {
  visible: boolean;
  options: OptionsModalOption[];
  onClose: () => void;
}

export default function OptionsModal({ visible, options, onClose }: OptionsModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + spacing.lg },
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Options card */}
        <View style={styles.card}>
          {options.map((option, index) => (
            <View key={option.label}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={[styles.optionRow, option.destructive && styles.optionRowDestructive]}
                onPress={() => {
                  onClose();
                  option.onPress();
                }}
                activeOpacity={0.6}
              >
                {option.icon && (
                  <View style={[styles.iconWrap, option.destructive && styles.iconWrapDestructive]}>
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={option.destructive ? colors.error : colors.text.secondary}
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.optionLabel,
                    option.destructive && styles.optionLabelDestructive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.6}>
          <Text style={styles.cancelLabel}>Annuler</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  card: {
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  optionRowDestructive: {
    backgroundColor: 'rgba(255, 92, 124, 0.06)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDestructive: {
    backgroundColor: 'rgba(255, 92, 124, 0.12)',
  },
  optionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  optionLabelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
