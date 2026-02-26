import { useState, useCallback } from 'react';
import {
  fetchConversationMessages,
  getCachedConversationMessages,
} from '@/services/messages';
import { MessageWithUsers } from '@/types';
import { log } from '@/utils/debug';

interface UseMessageLoaderResult {
  messages: MessageWithUsers[];
  loading: boolean;
  loadMessages: () => Promise<void>;
}

export function useMessageLoader(otherUserId: string): UseMessageLoaderResult {
  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { messages, loading, loadMessages };
}
