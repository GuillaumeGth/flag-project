import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchReadMessages, fetchUndiscoveredMessagesMetadata } from '@/services/messages';
import { MessageWithSender, UndiscoveredMessageMeta } from '@/types';

// Discovered message has full content
interface DiscoveredMessage extends MessageWithSender {
  isDiscovered: true;
}

// Undiscovered message has only metadata (no content for security)
interface UndiscoveredMessage extends UndiscoveredMessageMeta {
  isDiscovered: false;
}

type MessageItem = DiscoveredMessage | UndiscoveredMessage;

interface Props {
  navigation: any;
}

export default function InboxScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    const [readMessages, undiscoveredMeta] = await Promise.all([
      fetchReadMessages(),
      fetchUndiscoveredMessagesMetadata(),
    ]);

    const discovered: DiscoveredMessage[] = readMessages.map(m => ({ ...m, isDiscovered: true as const }));
    const undiscovered: UndiscoveredMessage[] = undiscoveredMeta.map(m => ({ ...m, isDiscovered: false as const }));

    const allMessages: MessageItem[] = [...discovered, ...undiscovered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setMessages(allMessages);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const [readMessages, undiscoveredMeta] = await Promise.all([
      fetchReadMessages(),
      fetchUndiscoveredMessagesMetadata(),
    ]);

    const discovered: DiscoveredMessage[] = readMessages.map(m => ({ ...m, isDiscovered: true as const }));
    const undiscovered: UndiscoveredMessage[] = undiscoveredMeta.map(m => ({ ...m, isDiscovered: false as const }));

    const allMessages: MessageItem[] = [...discovered, ...undiscovered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setMessages(allMessages);
    setRefreshing(false);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const getContentPreview = (message: MessageItem) => {
    if (!message.isDiscovered) {
      return 'Message non découvert';
    }
    switch (message.content_type) {
      case 'photo':
        return '📷 Photo';
      case 'audio':
        return '🎤 Audio';
      default:
        return message.text_content?.substring(0, 50) + (message.text_content && message.text_content.length > 50 ? '...' : '') || '';
    }
  };

  const renderItem = ({ item }: { item: MessageItem }) => {
    const isBlurred = !item.isDiscovered;

    const handlePress = () => {
      if (item.isDiscovered) {
        navigation.navigate('ReadMessage', { message: item });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.messageItem, isBlurred && styles.messageItemBlurred]}
        onPress={handlePress}
        activeOpacity={isBlurred ? 1 : 0.7}
      >
        <View style={[styles.avatar, isBlurred && styles.avatarBlurred]}>
          {item.isDiscovered && item.sender?.avatar_url ? (
            <Image source={{ uri: item.sender.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color={isBlurred ? '#ccc' : '#999'} />
          )}
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.senderName, isBlurred && styles.textBlurred]}>
              {item.isDiscovered ? (item.sender?.display_name || 'Utilisateur') : '••••••••'}
            </Text>
            <Text style={[styles.date, isBlurred && styles.textBlurred]}>
              {formatDate(item.isDiscovered && item.read_at ? item.read_at : item.created_at)}
            </Text>
          </View>
          <Text style={[styles.preview, isBlurred && styles.previewBlurred]} numberOfLines={1}>
            {getContentPreview(item)}
          </Text>
        </View>

        {isBlurred ? (
          <Ionicons name="lock-closed" size={18} color="#ccc" />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Aucun message</Text>
          <Text style={styles.emptySubtext}>
            Vos conversations apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    paddingVertical: 8,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  preview: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  messageItemBlurred: {
    backgroundColor: '#fafafa',
    opacity: 0.8,
  },
  avatarBlurred: {
    backgroundColor: '#e8e8e8',
  },
  textBlurred: {
    color: '#bbb',
  },
  previewBlurred: {
    color: '#ccc',
    fontStyle: 'italic',
  },
});
