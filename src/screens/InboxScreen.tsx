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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConversations, FLAG_BOT_ID } from '@/services/messages';
import { Conversation } from '@/types';
import { colors } from '@/theme';

interface Props {
  navigation: any;
}

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('[InboxScreen] useEffect[user] fired, user =', user?.id);
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[InboxScreen] focus event fired');
      loadConversations();
    });
    return unsubscribe;
  }, [navigation]);

  const loadConversations = async () => {
    console.log('[InboxScreen] loadConversations: START');
    setLoading(true);
    try {
      const data = await fetchConversations();
      console.log('[InboxScreen] loadConversations: got', data.length, 'conversations');
      setConversations(data);
    } catch (error) {
      console.error('[InboxScreen] Error loading conversations:', error);
      setConversations([]);
    } finally {
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
    const isUndiscovered = !lastMessage.is_from_me && !lastMessage.is_read;

    // Si le dernier message est un message non découvert reçu, ne pas afficher de preview
    if (isUndiscovered) {
      return 'Nouveau message à découvrir';
    }

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
                <Ionicons name="eye-off" size={14} color={colors.textSecondary} />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  botAvatar: {
    backgroundColor: colors.surfaceLight,
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
    color: colors.textPrimary,
  },
  userNameUnread: {
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateUnread: {
    color: colors.primary,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  undiscoveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: colors.primary,
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
