import { useState, useCallback, useEffect } from 'react';
import {
  fetchConversationMessages,
  getCachedConversationMessages,
} from '@/services/messages';
import { supabase } from '@/services/supabase';
import { MessageWithUsers } from '@/types';
import { log } from '@/utils/debug';
import { useAuth } from '@/contexts/AuthContext';

interface UseMessageLoaderResult {
  messages: MessageWithUsers[];
  loading: boolean;
  loadMessages: () => Promise<void>;
}

export function useMessageLoader(otherUserId: string): UseMessageLoaderResult {
  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadMessages = useCallback(async () => {
    if (messages.length === 0) {
      const cached = await getCachedConversationMessages(otherUserId);
      if (cached && cached.length > 0) {
        log('useMessageLoader', 'showing', cached.length, 'cached messages');
        setMessages(cached);
      }
    }

    const data = await fetchConversationMessages(otherUserId);
    setMessages(data);
    setLoading(false);
  }, [otherUserId]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`conversation:${user.id}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as { sender_id?: string };
          if (newMsg?.sender_id === otherUserId) {
            log('useMessageLoader', 'realtime: new message from', otherUserId);
            loadMessages();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updated = payload.new as { id: string; deleted_by_sender?: boolean; sender_id?: string };
          if (updated.deleted_by_sender && (updated.sender_id === otherUserId || updated.sender_id === user.id)) {
            log('useMessageLoader', 'realtime: message deleted in conversation', updated.id);
            setMessages((prev) =>
              prev.map((m) => m.id === updated.id ? { ...m, deleted_by_sender: true } : m)
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, otherUserId]);

  return { messages, loading, loadMessages };
}
