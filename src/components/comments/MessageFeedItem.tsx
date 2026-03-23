import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Message } from '@/types';
import { CommentWithUser, CommentWithReplies } from '@/types/comments';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCommentsForMessage,
  fetchMessageLikes,
  createComment,
  deleteComment,
  toggleCommentLike,
  toggleMessageLike,
} from '@/services/comments';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import MessageContentDisplay from '@/components/shared/MessageContentDisplay';
import CommentList from './CommentList';
import CommentInput from './CommentInput';

interface MessageFeedItemProps {
  message: Message;
  senderName?: string;
  senderAvatarUrl?: string | null;
  /** undefined = own profile (always clear). false = not discovered (blurred). true = discovered (clear). */
  isDiscovered?: boolean;
  onUserPress?: (userId: string) => void;
  onInputFocus?: () => void;
  onMapPress?: () => void;
}

export default function MessageFeedItem({
  message,
  senderName,
  senderAvatarUrl,
  isDiscovered,
  onUserPress,
  onInputFocus,
  onMapPress,
}: MessageFeedItemProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const loadComments = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchCommentsForMessage(message.id, user.id);
    setComments(data);
    setLoaded(true);
  }, [message.id, user?.id]);

  const loadLikes = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchMessageLikes([message.id], user.id);
    const info = data[message.id];
    if (info) {
      setLikeCount(info.count);
      setLiked(info.hasLiked);
    }
  }, [message.id, user?.id]);

  // Load comments and likes on first render
  React.useEffect(() => {
    loadComments();
    loadLikes();
  }, [loadComments, loadLikes]);

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

  const handleToggleLike = useCallback(async () => {
    // Optimistic update
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    await toggleMessageLike(message.id, liked);
  }, [message.id, liked]);

  const commentCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  // isDiscovered === false → message not yet physically discovered → show blurred preview
  if (isDiscovered === false) {
    return (
      <View style={styles.container}>
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

        <TouchableOpacity style={styles.undiscoveredCard} onPress={onMapPress} activeOpacity={0.8}>
          {message.content_type === 'photo' && message.media_url ? (
            <Image source={{ uri: message.media_url }} style={styles.undiscoveredImage} blurRadius={50} />
          ) : null}
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.undiscoveredContent}>
            <Ionicons name="eye-off-outline" size={32} color="rgba(190,170,255,0.7)" />
            <Text style={styles.undiscoveredTitle}>Fläag non découvert</Text>
            <Text style={styles.undiscoveredHint}>Approche-toi pour le lire</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.separator} />
      </View>
    );
  }

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
      <MessageContentDisplay
        message={message}
        variant="feed"
        renderAfterMedia={() => (
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionItem} onPress={handleToggleLike} activeOpacity={0.7}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={20}
                color={liked ? colors.error : colors.text.secondary}
              />
              {likeCount > 0 && (
                <Text style={[styles.actionCount, liked && styles.actionCountActive]}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={onMapPress} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
      />

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
        onFocus={onInputFocus}
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
  actionCountActive: {
    color: colors.error,
  },
  separator: {
    height: 8,
    backgroundColor: colors.background.secondary,
  },
  undiscoveredCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  undiscoveredImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  undiscoveredContent: {
    alignItems: 'center',
    gap: 6,
  },
  undiscoveredTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  undiscoveredHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
});
