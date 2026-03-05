import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageWithUsers } from '@/types';
import { colors, spacing, radius, typography } from '@/theme-redesign';

interface ReplyPreviewProps {
  replyTo: MessageWithUsers;
  onCancel: () => void;
}

function getPreviewText(msg: MessageWithUsers): string {
  if (msg.content_type === 'audio') return 'Message audio';
  if (msg.content_type === 'photo') return 'Photo';
  return msg.text_content ?? '';
}

export default function ReplyPreview({ replyTo, onCancel }: ReplyPreviewProps) {
  const senderName = replyTo.sender?.display_name ?? 'Utilisateur';
  const isPhoto = replyTo.content_type === 'photo' && !!replyTo.media_url;
  const previewText = getPreviewText(replyTo);

  return (
    <View style={styles.container}>
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.senderName} numberOfLines={1}>{senderName}</Text>
        <View style={styles.previewRow}>
          {replyTo.content_type === 'audio' && (
            <Ionicons name="mic" size={12} color={colors.text.tertiary} style={styles.icon} />
          )}
          {replyTo.content_type === 'photo' && !isPhoto && (
            <Ionicons name="image" size={12} color={colors.text.tertiary} style={styles.icon} />
          )}
          <Text style={styles.previewText} numberOfLines={1}>{previewText}</Text>
        </View>
      </View>
      {isPhoto && (
        <Image source={{ uri: replyTo.media_url! }} style={styles.thumbnail} />
      )}
      <TouchableOpacity onPress={onCancel} style={styles.cancelButton} hitSlop={CANCEL_HIT_SLOP}>
        <Ionicons name="close" size={16} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const CANCEL_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    overflow: 'hidden',
    paddingRight: spacing.sm,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.primary.violet,
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  senderName: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.primary.violet,
    marginBottom: 2,
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
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    marginHorizontal: spacing.xs,
  },
  cancelButton: {
    padding: spacing.xs,
  },
});
