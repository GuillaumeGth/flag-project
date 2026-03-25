import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  fetchUndiscoveredMessagesForMap,
  getCachedMapMessages,
  fetchFollowingPublicMessages,
} from '@/services/messages';
import { supabase, getCachedUserId } from '@/services/supabase';
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

  // Realtime: listen for private messages addressed to current user
  useEffect(() => {
    const currentUserId = getCachedUserId();
    if (!currentUserId) return;

    const channel = supabase
      .channel('map-private-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (_payload) => {
          log('useMapMessages', 'realtime: new private message for current user, refreshing map');
          loadMessages();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
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
  }, [loadMessages]);

  // Poll for public messages (following feed) every 3 minutes while map is active
  useEffect(() => {
    const interval = setInterval(() => {
      log('useMapMessages', 'poll: refreshing public messages');
      loadMessages();
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  // Refresh when app comes back to foreground
  const appStateRef = useRef<AppStateStatus>(AppState.currentState ?? 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        log('useMapMessages', 'app foregrounded, refreshing map');
        loadMessages();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [loadMessages]);

  return { messages, loading, loadMessages, setMessages };
}
