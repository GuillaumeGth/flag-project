import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';

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

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.md },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <GlassCard withBorder style={styles.card}>
              {options.map((option, index) => (
                <View key={option.label}>
                  {index > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      onClose();
                      option.onPress();
                    }}
                    activeOpacity={0.7}
                  >
                    {option.icon && (
                      <Ionicons
                        name={option.icon}
                        size={20}
                        color={option.destructive ? colors.error : colors.text.secondary}
                      />
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
            </GlassCard>

            <GlassCard withBorder style={[styles.card, styles.cancelCard]}>
              <TouchableOpacity style={styles.optionRow} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelLabel}>Annuler</Text>
              </TouchableOpacity>
            </GlassCard>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  card: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  cancelCard: {
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  cancelLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.lg,
  },
});
