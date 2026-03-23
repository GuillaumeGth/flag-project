import { useState, useCallback, useEffect } from 'react';
import { fetchMyPublicMessages, fetchUserPublicMessages, fetchDiscoveredPublicMessageIds } from '@/services/messages';
import { fetchCommentCounts } from '@/services/comments';
import { Message } from '@/types';

interface UseProfileMessagesResult {
  messages: Message[];
  commentCounts: Record<string, number>;
  discoveredIds: Set<string>;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * Shared hook for loading public messages on profile screens.
 *
 * - `userId` = undefined → loads the current user's own public messages (all considered discovered).
 * - `userId` = string    → loads another user's public messages + which ones are discovered.
 */
export function useProfileMessages(userId?: string): UseProfileMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = userId
      ? await fetchUserPublicMessages(userId)
      : await fetchMyPublicMessages();

    setMessages(data);

    if (data.length > 0) {
      const ids = data.map(m => m.id);
      const [counts, discovered] = await Promise.all([
        fetchCommentCounts(ids),
        userId ? fetchDiscoveredPublicMessageIds(ids) : Promise.resolve(new Set<string>()),
      ]);
      setCommentCounts(counts);
      setDiscoveredIds(discovered);
    }
  }, [userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { messages, commentCounts, discoveredIds, loading, refreshing, onRefresh };
}
