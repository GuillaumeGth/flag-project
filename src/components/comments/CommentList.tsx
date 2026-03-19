import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CommentWithUser, CommentWithReplies } from '@/types/comments';
import { colors, spacing, typography } from '@/theme-redesign';
import CommentItem from './CommentItem';

interface CommentListProps {
  comments: CommentWithReplies[];
  currentUserId: string;
  onReply: (comment: CommentWithUser) => void;
  onLike: (commentId: string, hasLiked: boolean) => void;
  onDelete: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
}

export default function CommentList({
  comments,
  currentUserId,
  onReply,
  onLike,
  onDelete,
  onUserPress,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun commentaire</Text>
      </View>
    );
  }

  return (
    <View>
      {comments.map((comment) => (
        <View key={comment.id}>
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            onReply={onReply}
            onLike={onLike}
            onDelete={onDelete}
            onUserPress={onUserPress}
          />
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isReply
              onLike={onLike}
              onDelete={onDelete}
              onUserPress={onUserPress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
});
