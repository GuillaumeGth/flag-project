import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, radius, spacing, typography } from '@/theme-redesign';

export type MapMode = 'explore' | 'mine';

interface MapModePillProps {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
  style?: ViewStyle;
}

const ACTIVE_GRADIENT = ['rgba(124, 92, 252, 0.7)', 'rgba(0, 229, 255, 0.5)'] as const;
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 0 } as const;

export default function MapModePill({ mode, onChange, style }: MapModePillProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView intensity={40} tint="dark" style={styles.pill}>
        <View style={styles.pillInner}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.segment}
            onPress={() => onChange('explore')}
          >
            {mode === 'explore' ? (
              <LinearGradient
                colors={ACTIVE_GRADIENT}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={styles.segmentActive}
              >
                <Ionicons name="compass" size={14} color="#fff" />
                <Text style={styles.labelActive}>Explorer</Text>
              </LinearGradient>
            ) : (
              <View style={styles.segmentInactive}>
                <Ionicons name="compass-outline" size={14} color="#fff" />
                <Text style={styles.labelInactive}>Explorer</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.segment}
            onPress={() => onChange('mine')}
          >
            {mode === 'mine' ? (
              <LinearGradient
                colors={ACTIVE_GRADIENT}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={styles.segmentActive}
              >
                <Ionicons name="flag" size={14} color="#fff" />
                <Text style={styles.labelActive}>Mes Flaags</Text>
              </LinearGradient>
            ) : (
              <View style={styles.segmentInactive}>
                <Ionicons name="flag-outline" size={14} color="#fff" />
                <Text style={styles.labelInactive}>Mes Flaags</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillInner: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  segment: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  segmentActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  segmentInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  labelActive: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelInactive: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
