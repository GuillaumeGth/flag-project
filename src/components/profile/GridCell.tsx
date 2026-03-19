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
  commentCount?: number;
  discovered?: boolean;
  onUndiscoveredPress?: (message: Message) => void;
}

function CommentCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.commentBadge}>
      <Ionicons name="chatbubble" size={10} color={colors.text.primary} />
      <Text style={styles.commentBadgeText}>{count}</Text>
    </View>
  );
}

export default function GridCell({
  item,
  index,
  onPress,
  commentCount,
  discovered = true,
  onUndiscoveredPress,
}: GridCellProps) {
  const [itemFade] = useState(new Animated.Value(0));
  const fadeStyle = useMemo(() => ({ opacity: itemFade }), [itemFade]);
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleUndiscoveredPress = useCallback(
    () => onUndiscoveredPress?.(item),
    [onUndiscoveredPress, item]
  );

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

  // Undiscovered state
  if (!discovered) {
    return (
      <Animated.View style={fadeStyle}>
        <TouchableOpacity
          style={[styles.cell, styles.cellUndiscovered]}
          onPress={handleUndiscoveredPress}
        >
          {item.content_type === 'photo' && item.media_url && (
            <Image source={{ uri: item.media_url }} style={styles.cellImageBlurred} blurRadius={150} />
          )}
          {item.content_type === 'audio' && (
            <Ionicons name="mic" size={32} color="rgba(107,114,128,0.3)" />
          )}
          {item.content_type === 'text' && (
            <Text style={styles.cellTextBlurred} numberOfLines={4}>
              {'••••••••••••\n••••••••\n••••••••••'}
            </Text>
          )}
          <View style={styles.lockOverlay}>
            <Ionicons name="eye-off" size={40} color="rgba(190,170,255,0.2)" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const badge = commentCount != null && commentCount > 0
    ? <CommentCountBadge count={commentCount} />
    : null;

  if (item.content_type === 'photo') {
    return (
      <Animated.View style={fadeStyle}>
        <TouchableOpacity style={styles.cell} onPress={handlePress}>
          <Image source={{ uri: item.media_url }} style={styles.cellImage} />
          <LinearGradient colors={CELL_GRADIENT_COLORS} style={styles.cellOverlay} />
          {badge}
          {discoveryBadge}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (item.content_type === 'audio') {
    return (
      <Animated.View style={fadeStyle}>
        <TouchableOpacity style={[styles.cell, styles.cellPlaceholder]} onPress={handlePress}>
          <View style={styles.cellIconContainer}>
            <Ionicons name="mic" size={32} color={colors.primary.cyan} />
          </View>
          {badge}
          {discoveryBadge}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={fadeStyle}>
      <TouchableOpacity style={[styles.cell, styles.cellPlaceholder]} onPress={handlePress}>
        <Text style={styles.cellText} numberOfLines={4}>
          {item.text_content}
        </Text>
        {badge}
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
  cellImageBlurred: {
    ...StyleSheet.absoluteFillObject,
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
  cellTextBlurred: {
    color: 'rgba(107,114,128,0.3)',
    fontSize: 12,
    textAlign: 'center',
  },
  cellUndiscovered: {
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  commentBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  commentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  discoveryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  discoveryCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
