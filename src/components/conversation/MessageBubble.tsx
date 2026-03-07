import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageWithUsers } from '@/types';
import { ReactionSummary } from '@/types/reactions';
import { colors, spacing, radius, shadows, typography } from '@/theme-redesign';
import { formatTime, formatDateSeparator } from '@/utils/date';
import GlassCard from '@/components/redesign/GlassCard';
import ReactionBadge from './ReactionBadge';
import QuotedMessage from './QuotedMessage';

// Module-level interpolation config — never declared inside render
const ANIM_INPUT_RANGE = [0, 1] as const;
const ANIM_OUTPUT_RANGE = [20, 0] as const;

interface MessageBubbleProps {
  message: MessageWithUsers;
  isFromMe: boolean;
  animValue: Animated.Value;
  showDateSeparator: boolean;
  isPlaying: boolean;
  playingMessageId: string | null;
  reactions: ReactionSummary[];
  isSelected: boolean;
  onPress: () => void;
  onPlayAudio: (message: MessageWithUsers) => void;
  onViewImage: (message: MessageWithUsers) => void;
  onNavigateToMap: (location: MessageWithUsers['location']) => void;
  onLongPress: (pageY: number) => void;
  onReactionPress: (emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  showSenderNameInReply?: boolean;
}

export default function MessageBubble({
  message,
  isFromMe,
  animValue,
  showDateSeparator,
  isPlaying,
  playingMessageId,
  reactions,
  isSelected,
  onPress,
  onPlayAudio,
  onViewImage,
  onNavigateToMap,
  onLongPress,
  onReactionPress,
  onScrollToMessage,
  showSenderNameInReply = true,
}: MessageBubbleProps) {
  const isUndiscovered = !isFromMe && !message.is_read && message.location;
  const isDeleted = isFromMe ? !!message.deleted_by_sender : !!message.deleted_by_recipient;
  const hasReactions = reactions.length > 0;

  const animatedStyle = useMemo(
    () => ({
      opacity: animValue,
      transform: [
        {
          translateY: animValue.interpolate({
            inputRange: ANIM_INPUT_RANGE,
            outputRange: ANIM_OUTPUT_RANGE,
          }),
        },
      ],
    }),
    [animValue]
  );

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
          <Pressable
            onPress={() => onNavigateToMap(message.location)}
            onLongPress={(e) => onLongPress(e.nativeEvent.pageY)}
            delayLongPress={400}
          >
            <GlassCard style={styles.undiscoveredBubble}>
              <View style={styles.blurredContent}>
                <Ionicons name="lock-closed" size={20} color={colors.primary.magenta} />
                <Text style={styles.undiscoveredText}>Message géolocalisé</Text>
              </View>
              <Text style={styles.messageTime}>{formatTime(message.created_at)}</Text>
            </GlassCard>
          </Pressable>
        ) : (
          // Wrapper gives position:relative context for the floating reactions
          <View style={styles.bubbleWrapper}>
            <Pressable
              onPress={onPress}
              onLongPress={!isDeleted ? (e) => onLongPress(e.nativeEvent.pageY) : undefined}
              delayLongPress={400}
              style={[
                styles.messageBubble,
                isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
                hasReactions && styles.messageBubbleWithReactions,
                isDeleted && styles.messageBubbleDeleted,
              ]}
            >
              {isDeleted ? (
                <Text style={styles.deletedText}>Message supprimé</Text>
              ) : (
                <>
                  {message.reply_to?.id && (
                    <QuotedMessage
                      reply={message.reply_to}
                      isFromMe={isFromMe}
                      showSenderName={showSenderNameInReply}
                      onPress={onScrollToMessage && message.reply_to.id
                        ? () => onScrollToMessage(message.reply_to!.id!)
                        : undefined}
                    />
                  )}
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
                </>
              )}

              <View style={styles.messageFooter}>
                {!isDeleted && message.location && (
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
            </Pressable>

            {/* Floating reactions — positioned at bottom-right of the bubble */}
            {hasReactions && (
              <View
                style={[
                  styles.reactionsFloat,
                  isFromMe ? styles.reactionsFloatRight : styles.reactionsFloatLeft,
                ]}
              >
                {reactions.map((reaction) => (
                  <ReactionBadge
                    key={reaction.emoji}
                    reaction={reaction}
                    onPress={() => onReactionPress(reaction.emoji)}
                  />
                ))}
              </View>
            )}
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
  bubbleWrapper: {
    position: 'relative',
    minWidth: '50%',
    maxWidth: '75%',
  },
  messageBubble: {
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
  // Extra bottom margin when reactions are floating below the bubble
  messageBubbleWithReactions: {
    marginBottom: 16,
  },
  messageBubbleSelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(124, 92, 252, 0.6)',
    opacity: 0.85,
  },
  messageBubbleDeleted: {
    opacity: 0.5,
  },
  deletedText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  // Reactions row floats outside the bubble at bottom-right
  reactionsFloat: {
    position: 'absolute',
    bottom: -8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  reactionsFloatRight: {
    right: 4,
  },
  reactionsFloatLeft: {
    left: 4,
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
