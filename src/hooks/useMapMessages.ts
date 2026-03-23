import { useState, useCallback, useEffect } from 'react';
import {
  fetchUndiscoveredMessagesForMap,
  getCachedMapMessages,
  fetchFollowingPublicMessages,
} from '@/services/messages';
import { supabase } from '@/services/supabase';
import { UndiscoveredMessageMapMeta } from '@/types';
import { log } from '@/utils/debug';

interface UseMapMessagesResult {
  messages: UndiscoveredMessageMapMeta[];
  loading: boolean;
  loadMessages: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<UndiscoveredMessageMapMeta[]>>;
}

export function useMapMessages(): UseMapMessagesResult {
  const [messages, setMessages] = useState<UndiscoveredMessageMapMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    log('useMapMessages', 'loadMessages: START');

    if (messages.length === 0) {
      const cached = await getCachedMapMessages();
      if (cached && cached.length > 0) {
        log('useMapMessages', 'showing', cached.length, 'cached messages');
        setMessages(cached);
        setLoading(false);
      }
    }

    const [data, followingData] = await Promise.all([
      fetchUndiscoveredMessagesForMap(),
      fetchFollowingPublicMessages(),
    ]);

    const mergedMap = new Map<string, UndiscoveredMessageMapMeta>();
    for (const msg of data) mergedMap.set(msg.id, msg);
    for (const msg of followingData) {
      if (!mergedMap.has(msg.id)) mergedMap.set(msg.id, msg);
    }
    const allMessages = Array.from(mergedMap.values());

    log('useMapMessages', 'loadMessages: got', data.length, 'undiscovered +', followingData.length, 'following =', allMessages.length, 'total');
    setMessages(allMessages);
    setLoading(false);
  }, []);

  // Listen for message deletions in real-time and remove markers instantly
  useEffect(() => {
    const channel = supabase
      .channel('map-message-deletions')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as { id: string; deleted_by_sender?: boolean };
          if (updated.deleted_by_sender) {
            log('useMapMessages', 'realtime: removing deleted marker', updated.id);
            setMessages((prev) => prev.filter((m) => m.id !== updated.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { messages, loading, loadMessages, setMessages };
}
