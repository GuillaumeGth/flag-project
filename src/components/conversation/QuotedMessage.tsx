import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageReply } from '@/types/index';
import { colors, spacing, radius, typography } from '@/theme-redesign';

interface QuotedMessageProps {
  reply: MessageReply;
  isFromMe: boolean;
  showSenderName?: boolean;
  onPress?: () => void;
}

export default function QuotedMessage({ reply, isFromMe, showSenderName = true, onPress }: QuotedMessageProps) {
  const accentColor = isFromMe ? 'rgba(255,255,255,0.5)' : colors.primary.violet;
  const bgColor = isFromMe ? 'rgba(0,0,0,0.15)' : 'rgba(124,92,252,0.08)';

  const isDeleted = reply.deleted_by_sender && reply.deleted_by_recipient;

  if (isDeleted) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <Text style={styles.deletedText}>Message supprimé</Text>
      </View>
    );
  }

  const isPhoto = reply.content_type === 'photo' && !!reply.media_url;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.container, { backgroundColor: bgColor, opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        {showSenderName && (
          <Text style={[styles.senderName, { color: accentColor }]} numberOfLines={1}>
            {reply.sender?.display_name ?? 'Utilisateur'}
          </Text>
        )}
        <View style={styles.previewRow}>
          {reply.content_type === 'audio' && (
            <Ionicons name="mic" size={11} color={colors.text.tertiary} style={styles.icon} />
          )}
          {reply.content_type === 'photo' && !isPhoto && (
            <Ionicons name="image" size={11} color={colors.text.tertiary} style={styles.icon} />
          )}
          <Text style={styles.previewText} numberOfLines={1}>
            {reply.content_type === 'audio'
              ? 'Message audio'
              : reply.content_type === 'photo' && !reply.text_content
              ? 'Photo'
              : reply.text_content ?? ''}
          </Text>
        </View>
      </View>
      {isPhoto && (
        <Image source={{ uri: reply.media_url! }} style={styles.thumbnail} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    overflow: 'hidden',
    paddingRight: spacing.xs,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: spacing.xs,
  },
  content: {
    flex: 1,
    paddingVertical: 4,
  },
  senderName: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginBottom: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 3,
  },
  previewText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  deletedText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
