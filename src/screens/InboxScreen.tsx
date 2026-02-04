import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchConversations, FLAG_BOT_ID } from '@/services/messages';
import { Conversation } from '@/types';

// DEBUG MODE - set to false to disable on-screen logs
const DEBUG_MODE = true;

interface Props {
  navigation: any;
}

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isLoadingRef = useRef(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // Load conversations on mount and when screen comes into focus
  useEffect(() => {
    // Load immediately on mount
    loadConversations();

    // Also refresh when navigating back to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      loadConversations();
    });
    return unsubscribe;
  }, [navigation]);

  const loadConversations = async () => {
    // Prevent concurrent calls
    if (isLoadingRef.current) {
      addLog('Already loading, skipping...');
      return;
    }

    addLog('loadConversations started');
    isLoadingRef.current = true;
    setLoading(true);
    try {
      addLog('Calling fetchConversations...');
      const data = await fetchConversations();
      addLog(`Got ${data.length} conversations`);
      setConversations(data);
    } catch (error: any) {
      addLog(`ERROR: ${error?.message || error}`);
      setConversations([]);
    } finally {
      addLog('Setting loading to false');
      isLoadingRef.current = false;
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchConversations();
    setConversations(data);
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
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const getMessagePreview = (conversation: Conversation) => {
    const { lastMessage } = conversation;
    const prefix = lastMessage.is_from_me ? 'Vous: ' : '';

    switch (lastMessage.content_type) {
      case 'photo':
        return `${prefix}Photo`;
      case 'audio':
        return `${prefix}Audio`;
      default:
        const text = lastMessage.text_content || '';
        const truncated = text.length > 40 ? text.substring(0, 40) + '...' : text;
        return `${prefix}${truncated}`;
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isBot = item.id === FLAG_BOT_ID;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('Conversation', {
          otherUserId: item.id,
          otherUserName: item.otherUser.display_name || 'Utilisateur',
          otherUserAvatarUrl: item.otherUser.avatar_url,
        })}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, isBot && styles.botAvatar]}>
          {item.otherUser.avatar_url ? (
            <Image source={{ uri: item.otherUser.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons
              name={isBot ? 'flag' : 'person'}
              size={24}
              color={isBot ? '#4A90D9' : '#999'}
            />
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, hasUnread && styles.userNameUnread]}>
              {item.otherUser.display_name || 'Utilisateur'}
            </Text>
            <Text style={[styles.date, hasUnread && styles.dateUnread]}>
              {formatDate(item.lastMessage.created_at)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {getMessagePreview(item)}
            </Text>
            {hasUnread && (
              <View style={styles.undiscoveredBadge}>
                <Ionicons name="eye-off" size={14} color="#999" />
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Chargement...</Text>
        {DEBUG_MODE && (
          <ScrollView style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Logs:</Text>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugLog}>{log}</Text>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={() => navigation.navigate('SelectRecipient')}
        >
          <Ionicons name="create-outline" size={24} color="#4A90D9" />
        </TouchableOpacity>
      </View>

      {DEBUG_MODE && debugLogs.length > 0 && (
        <ScrollView style={styles.debugContainerInline}>
          <Text style={styles.debugTitle}>Debug Logs:</Text>
          {debugLogs.map((log, index) => (
            <Text key={index} style={styles.debugLog}>{log}</Text>
          ))}
        </ScrollView>
      )}

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Aucune conversation</Text>
          <Text style={styles.emptySubtext}>
            Commencez une conversation en appuyant sur le bouton +
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('SelectRecipient')}
          >
            <Text style={styles.startButtonText}>Nouvelle conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  debugContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 10,
  },
  debugTitle: {
    color: '#4A90D9',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugLog: {
    color: '#0f0',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  debugContainerInline: {
    maxHeight: 150,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  newMessageButton: {
    padding: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  botAvatar: {
    backgroundColor: '#e8f4fd',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userNameUnread: {
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  dateUnread: {
    color: '#4A90D9',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  previewUnread: {
    color: '#333',
    fontWeight: '500',
  },
  undiscoveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
