import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types';
import { CommentWithUser, CommentWithReplies } from '@/types/comments';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCommentsForMessage,
  createComment,
  deleteComment,
  toggleCommentLike,
} from '@/services/comments';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import MessageContentDisplay from '@/components/shared/MessageContentDisplay';
import CommentList from './CommentList';
import CommentInput from './CommentInput';

interface MessageFeedItemProps {
  message: Message;
  senderName?: string;
  senderAvatarUrl?: string | null;
  onUserPress?: (userId: string) => void;
}

export default function MessageFeedItem({
  message,
  senderName,
  senderAvatarUrl,
  onUserPress,
}: MessageFeedItemProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const loadComments = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchCommentsForMessage(message.id, user.id);
    setComments(data);
    setLoaded(true);
  }, [message.id, user?.id]);

  // Load comments on first render
  React.useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleCreateComment = useCallback(async (text: string) => {
    const parentId = replyingTo?.id ?? undefined;
    setReplyingTo(null);

    const created = await createComment(message.id, text, parentId);
    if (created) {
      // Reload comments to get full data with user info
      loadComments();
    }
  }, [message.id, replyingTo, loadComments]);

  const handleDelete = useCallback(async (commentId: string) => {
    const ok = await deleteComment(commentId);
    if (ok) {
      // Remove from local state
      setComments(prev => {
        const filtered = prev.filter(c => c.id !== commentId);
        // Also remove from replies
        return filtered.map(c => ({
          ...c,
          replies: c.replies.filter(r => r.id !== commentId),
        }));
      });
    }
  }, []);

  const handleLike = useCallback(async (commentId: string, hasLiked: boolean) => {
    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          has_liked: !hasLiked,
          like_count: hasLiked ? c.like_count - 1 : c.like_count + 1,
        };
      }
      return {
        ...c,
        replies: c.replies.map(r => {
          if (r.id === commentId) {
            const rc = r as CommentWithReplies;
            return {
              ...r,
              has_liked: !hasLiked,
              like_count: hasLiked ? (rc.like_count ?? 1) - 1 : (rc.like_count ?? 0) + 1,
            };
          }
          return r;
        }),
      };
    }));

    await toggleCommentLike(commentId, hasLiked);
  }, []);

  const handleReply = useCallback((comment: CommentWithUser) => {
    setReplyingTo({
      id: comment.id,
      userName: comment.user.display_name || 'Utilisateur',
    });
  }, []);

  const commentCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  return (
    <View style={styles.container}>
      {/* Flag header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => onUserPress?.(message.sender_id)}
        activeOpacity={0.7}
      >
        <PremiumAvatar
          uri={senderAvatarUrl ?? undefined}
          name={senderName}
          size="small"
          withRing
          ringColor="gradient"
        />
        <View>
          <Text style={styles.senderName}>{senderName || 'Utilisateur'}</Text>
          <Text style={styles.date}>
            {new Date(message.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Flag content */}
      <MessageContentDisplay message={message} variant="feed" />

      {/* Action bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionItem}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.text.secondary} />
          {commentCount > 0 && (
            <Text style={styles.actionCount}>{commentCount}</Text>
          )}
        </View>
      </View>

      {/* Comments section */}
      {loaded && (
        <CommentList
          comments={comments}
          currentUserId={user?.id ?? ''}
          onReply={handleReply}
          onLike={handleLike}
          onDelete={handleDelete}
          onUserPress={onUserPress}
        />
      )}

      {/* Comment input */}
      <CommentInput
        onSubmit={handleCreateComment}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Separator */}
      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  senderName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionCount: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  separator: {
    height: 8,
    backgroundColor: colors.background.secondary,
  },
});
