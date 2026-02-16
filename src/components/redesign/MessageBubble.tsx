/**
 * MessageBubble - Premium message bubble with advanced animations
 * Includes shimmer effect, spring animations, and long-press reactions
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Pressable, Vibration } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import ShimmerEffect from './ShimmerEffect';

interface MessageBubbleProps {
  isFromMe: boolean;
  text?: string;
  mediaUrl?: string;
  contentType: 'text' | 'photo' | 'audio';
  timestamp: string;
  hasFlag?: boolean;
  isRead?: boolean;
  onImagePress?: () => void;
  onAudioPress?: () => void;
  onFlagPress?: () => void;
  isPlayingAudio?: boolean;
  showShimmer?: boolean;
}

export default function MessageBubble({
  isFromMe,
  text,
  mediaUrl,
  contentType,
  timestamp,
  hasFlag,
  isRead,
  onImagePress,
  onAudioPress,
  onFlagPress,
  isPlayingAudio,
  showShimmer = false,
}: MessageBubbleProps) {
  const scale = useSharedValue(0);
  const shimmerOpacity = useSharedValue(0);
  const [showReactions, setShowReactions] = useState(false);

  useEffect(() => {
    // Entrance animation with spring physics
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });

    // Shimmer effect for sent messages
    if (showShimmer && isFromMe) {
      setTimeout(() => {
        shimmerOpacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) })
        );
      }, 100);
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: scale.value,
      },
      {
        translateY: (1 - scale.value) * 10,
      },
    ],
    opacity: scale.value,
  }));

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  const handleLongPress = () => {
    Vibration.vibrate(50);
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    // Could trigger reaction picker here
  };

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.97, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onLongPress={handleLongPress}
        onPress={handlePress}
        delayLongPress={500}
      >
        <View
          style={[
            styles.bubble,
            isFromMe ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          {/* Shimmer overlay for sent messages */}
          {showShimmer && isFromMe && (
            <Animated.View style={[styles.shimmerOverlay, shimmerAnimatedStyle]}>
              <ShimmerEffect
                width={250}
                height={100}
                colors={[
                  'rgba(255, 255, 255, 0)',
                  'rgba(255, 255, 255, 0.3)',
                  'rgba(0, 229, 255, 0.3)',
                  'rgba(255, 255, 255, 0)',
                ]}
                duration={2000}
              />
            </Animated.View>
          )}

          {/* Photo */}
          {contentType === 'photo' && mediaUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={onImagePress}>
              <Image source={{ uri: mediaUrl }} style={styles.messageImage} />
            </TouchableOpacity>
          )}

          {/* Audio */}
          {contentType === 'audio' && mediaUrl && (
            <TouchableOpacity
              style={styles.audioMessage}
              activeOpacity={0.7}
              onPress={onAudioPress}
            >
              <View style={[styles.audioIconContainer, isFromMe && styles.audioIconRight]}>
                <Ionicons
                  name={isPlayingAudio ? 'pause' : 'play'}
                  size={18}
                  color={isFromMe ? '#fff' : colors.primary.cyan}
                />
              </View>
              <Text style={[styles.audioText, isFromMe && styles.audioTextRight]}>
                {isPlayingAudio ? 'En lecture...' : 'Message audio'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Text */}
          {text && (
            <Text style={[styles.messageText, isFromMe && styles.messageTextRight]}>
              {text}
            </Text>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {hasFlag && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onFlagPress}
                style={styles.flagButton}
              >
                <Ionicons
                  name="flag"
                  size={12}
                  color={isFromMe ? 'rgba(255, 255, 255, 0.7)' : colors.primary.cyan}
                />
              </TouchableOpacity>
            )}
            <Text style={[styles.timestamp, isFromMe && styles.timestampRight]}>
              {timestamp}
              {isFromMe ? (isRead ? ' ✓✓' : ' ✓') : ''}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.small,
  },
  bubbleLeft: {
    backgroundColor: colors.surface.glassDark,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.2)',
  },
  bubbleRight: {
    backgroundColor: '#4A7BA7',
    borderBottomRightRadius: radius.xs,
    ...shadows.medium,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  audioIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioIconRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  audioText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  audioTextRight: {
    color: colors.text.primary,
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    lineHeight: 20,
  },
  messageTextRight: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flagButton: {
    padding: 2,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  timestampRight: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
