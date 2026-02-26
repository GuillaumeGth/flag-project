import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '@/theme-redesign';

interface PremiumButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  withGlow?: boolean;
}

const SIZE_STYLES = {
  small: { paddingVertical: 8, paddingHorizontal: 16, fontSize: typography.sizes.sm },
  medium: { paddingVertical: 12, paddingHorizontal: 20, fontSize: typography.sizes.md },
  large: { paddingVertical: 16, paddingHorizontal: 28, fontSize: typography.sizes.lg },
};

const ICON_SIZES = {
  small: 16,
  medium: 20,
  large: 24,
};

/**
 * Premium Button Component with multiple variants
 */
export default function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  withGlow = false,
}: PremiumButtonProps) {

  const renderContent = () => (
    <View style={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={ICON_SIZES[size]}
              color="#fff"
              style={styles.iconLeft}
            />
          )}
          {title && (
            <Text
              style={[
                styles.text,
                { fontSize: SIZE_STYLES[size].fontSize },
                variant === 'ghost' && styles.textGhost,
              ]}
            >
              {title}
            </Text>
          )}
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={ICON_SIZES[size]}
              color="#fff"
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </View>
  );

  const buttonStyle = [
    styles.button,
    {
      paddingVertical: SIZE_STYLES[size].paddingVertical,
      paddingHorizontal: SIZE_STYLES[size].paddingHorizontal,
    },
    fullWidth && styles.fullWidth,
    withGlow && shadows.glow,
    disabled && styles.disabled,
    style,
  ];

  if (variant === 'gradient') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={buttonStyle}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        buttonStyle,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary.violet,
  },
  secondary: {
    backgroundColor: colors.surface.glass,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  textGhost: {
    color: colors.text.secondary,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
