import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Ionicons } from '@expo/vector-icons';
import { CommentWithUser, CommentWithReplies } from '@/types/comments';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import { useTranslation } from 'react-i18next';

interface CommentItemProps {
  comment: CommentWithUser & Partial<CommentWithReplies>;
  currentUserId: string;
  isReply?: boolean;
  onReply?: (comment: CommentWithUser) => void;
  onLike?: (commentId: string, hasLiked: boolean) => void;
  onDelete?: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'maintenant';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function CommentItem({
  comment,
  currentUserId,
  isReply = false,
  onReply,
  onLike,
  onDelete,
  onUserPress,
}: CommentItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [textTruncated, setTextTruncated] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const isOwn = comment.user_id === currentUserId;
  const likeCount = (comment as CommentWithReplies).like_count ?? 0;
  const hasLiked = (comment as CommentWithReplies).has_liked ?? false;

  const handleLongPress = useCallback(() => {
    if (!isOwn) return;
    setDeleteDialogVisible(true);
  }, [isOwn]);

  const handleDeleteConfirm = useCallback(() => {
    setDeleteDialogVisible(false);
    onDelete?.(comment.id);
  }, [comment.id, onDelete]);

  return (
    <>
    <ConfirmDialog
      visible={deleteDialogVisible}
      title={t('comments.deleteTitle')}
      message="Cette action est irréversible."
      confirmLabel="Supprimer"
      cancelLabel="Annuler"
      destructive
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteDialogVisible(false)}
    />
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={[styles.container, isReply && styles.replyContainer]}
    >
      <TouchableOpacity onPress={() => onUserPress?.(comment.user_id)}>
        <PremiumAvatar
          uri={comment.user.avatar_url ?? undefined}
          name={comment.user.display_name ?? undefined}
          size="small"
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onUserPress?.(comment.user_id)}>
            <Text style={styles.userName}>{comment.user.display_name || 'Utilisateur'}</Text>
          </TouchableOpacity>
          <Text style={styles.time}>{formatTimeAgo(comment.created_at)}</Text>
        </View>

        <Text
          style={styles.text}
          numberOfLines={expanded ? undefined : 3}
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length > 3 && !expanded) {
              setTextTruncated(true);
            }
          }}
        >
          {comment.text_content}
        </Text>

        {textTruncated && !expanded && (
          <TouchableOpacity onPress={() => setExpanded(true)}>
            <Text style={styles.seeMore}>{t('comments.seeMore')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          {!isReply && onReply && (
            <TouchableOpacity onPress={() => onReply(comment)} style={styles.actionButton}>
              <Text style={styles.actionText}>{t('comments.reply')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.likeButton}
        onPress={() => onLike?.(comment.id, hasLiked)}
      >
        <Ionicons
          name={hasLiked ? 'heart' : 'heart-outline'}
          size={16}
          color={hasLiked ? colors.error : colors.text.tertiary}
        />
        {likeCount > 0 && (
          <Text style={[styles.likeCount, hasLiked && styles.likeCountActive]}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  replyContainer: {
    paddingLeft: spacing.lg + 32 + spacing.sm, // avatar size + gap offset
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  userName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  time: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  text: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  seeMore: {
    fontSize: typography.sizes.xs,
    color: colors.text.accent,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  actionButton: {
    paddingVertical: 2,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  likeButton: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: 2,
  },
  likeCount: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  likeCountActive: {
    color: colors.error,
  },
});
