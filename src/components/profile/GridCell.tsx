import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Message } from '@/types';
import { colors, radius, spacing, typography } from '@/theme-redesign';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - 4) / 3;
const CELL_GRADIENT_COLORS = ['transparent', 'rgba(0,0,0,0.3)'] as const;

interface GridCellProps {
  item: Message;
  index: number;
  onPress: (message: Message) => void;
}

export default function GridCell({ item, index, onPress }: GridCellProps) {
  const [itemFade] = useState(new Animated.Value(0));
  const fadeStyle = useMemo(() => ({ opacity: itemFade }), [itemFade]);
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  useEffect(() => {
    const delay = index * 30;
    Animated.timing(itemFade, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const discoveryBadge = typeof item.discovery_count === 'number' && item.discovery_count > 0 ? (
    <View style={styles.discoveryBadge}>
      <Ionicons name="eye" size={10} color="#fff" />
      <Text style={styles.discoveryCount}>{item.discovery_count > 99 ? '99+' : item.discovery_count}</Text>
    </View>
  ) : null;

  if (item.content_type === 'photo') {
    return (
      <Animated.View style={fadeStyle}>
        <TouchableOpacity style={styles.cell} onPress={handlePress}>
          <Image source={{ uri: item.media_url }} style={styles.cellImage} />
          <LinearGradient colors={CELL_GRADIENT_COLORS} style={styles.cellOverlay} />
          {discoveryBadge}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (item.content_type === 'audio') {
    return (
      <Animated.View style={fadeStyle}>
        <View style={[styles.cell, styles.cellPlaceholder]}>
          <View style={styles.cellIconContainer}>
            <Ionicons name="mic" size={32} color={colors.primary.cyan} />
          </View>
          {discoveryBadge}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={fadeStyle}>
      <TouchableOpacity style={[styles.cell, styles.cellPlaceholder]} onPress={handlePress}>
        <Text style={styles.cellText} numberOfLines={4}>
          {item.text_content}
        </Text>
        {discoveryBadge}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: colors.surface.elevated,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  cellPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface.glassDark,
  },
  cellIconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  discoveryBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discoveryCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});
