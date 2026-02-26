import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageWithUsers } from '@/types';
import { colors, spacing, radius, shadows, typography } from '@/theme-redesign';
import { formatTime, formatDateSeparator } from '@/utils/date';
import GlassCard from '@/components/redesign/GlassCard';

interface MessageBubbleProps {
  message: MessageWithUsers;
  isFromMe: boolean;
  animValue: Animated.Value;
  showDateSeparator: boolean;
  isPlaying: boolean;
  playingMessageId: string | null;
  onPlayAudio: (message: MessageWithUsers) => void;
  onViewImage: (message: MessageWithUsers) => void;
  onNavigateToMap: (location: MessageWithUsers['location']) => void;
}

export default function MessageBubble({
  message,
  isFromMe,
  animValue,
  showDateSeparator,
  isPlaying,
  playingMessageId,
  onPlayAudio,
  onViewImage,
  onNavigateToMap,
}: MessageBubbleProps) {
  const isUndiscovered = !isFromMe && !message.is_read && message.location;

  const animatedStyle = useMemo(() => ({
    opacity: animValue,
    transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  }), [animValue]);

  return (
    <Animated.View style={[styles.messageContainer, animatedStyle]}>
      {showDateSeparator && (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>
            {formatDateSeparator(message.created_at)}
          </Text>
        </View>
      )}

      <View style={[styles.messageRow, isFromMe && styles.messageRowRight]}>
        {isUndiscovered ? (
          <TouchableOpacity
            onPress={() => onNavigateToMap(message.location)}
            activeOpacity={0.9}
          >
            <GlassCard style={styles.undiscoveredBubble}>
              <View style={styles.blurredContent}>
                <Ionicons name="lock-closed" size={20} color={colors.primary.magenta} />
                <Text style={styles.undiscoveredText}>Message géolocalisé</Text>
              </View>
              <Text style={styles.messageTime}>{formatTime(message.created_at)}</Text>
            </GlassCard>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.messageBubble,
              isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
            ]}
          >
            {message.content_type === 'photo' && message.media_url && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => onViewImage(message)}>
                <Image source={{ uri: message.media_url }} style={styles.messageImage} />
              </TouchableOpacity>
            )}

            {message.content_type === 'audio' && message.media_url && (
              <TouchableOpacity
                style={styles.audioMessage}
                activeOpacity={0.7}
                onPress={() => onPlayAudio(message)}
              >
                <View style={styles.audioIconContainer}>
                  <Ionicons
                    name={playingMessageId === message.id && isPlaying ? 'pause' : 'play'}
                    size={18}
                    color={isFromMe ? colors.text.primary : colors.primary.cyan}
                  />
                </View>
                <Text style={[styles.audioText, isFromMe && styles.audioTextRight]}>
                  {playingMessageId === message.id && isPlaying ? 'En lecture...' : 'Message audio'}
                </Text>
              </TouchableOpacity>
            )}

            {message.text_content && (
              <Text style={[styles.messageText, isFromMe && styles.messageTextRight]}>
                {message.text_content}
              </Text>
            )}

            <View style={styles.messageFooter}>
              {message.location && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onNavigateToMap(message.location)}
                  style={styles.flagButton}
                >
                  <Ionicons
                    name="flag"
                    size={12}
                    color={isFromMe ? colors.text.secondary : colors.primary.cyan}
                  />
                </TouchableOpacity>
              )}
              <Text style={[styles.messageTime, isFromMe && styles.messageTimeRight]}>
                {formatTime(message.created_at)}
                {isFromMe ? (message.is_read ? ' ✓✓' : ' ✓') : ''}
              </Text>
            </View>
          </View>
        )}
      </View>

      {isUndiscovered && (
        <Text style={styles.undiscoveredHint}>Tap to view on map</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: spacing.sm,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateSeparatorText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    backgroundColor: colors.surface.glass,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  messageBubbleLeft: {
    backgroundColor: colors.surface.glassDark,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.2)',
  },
  messageBubbleRight: {
    backgroundColor: colors.message.sent,
    borderBottomRightRadius: radius.xs,
    ...shadows.medium,
  },
  undiscoveredBubble: {
    padding: spacing.md,
    maxWidth: '75%',
    backgroundColor: colors.message.undiscovered,
  },
  blurredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  undiscoveredText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  undiscoveredHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
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
    color: colors.text.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flagButton: {
    padding: 2,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  messageTimeRight: {
    color: colors.text.secondary,
  },
});
