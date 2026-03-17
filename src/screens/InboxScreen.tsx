import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConversations, getCachedConversations, FLAG_BOT_ID } from '@/services/messages';
import { supabase } from '@/services/supabase';
import { Conversation, MainTabParamList, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import EmptyState from '@/components/EmptyState';
import { log } from '@/utils/debug';
import { formatMessageDate } from '@/utils/date';

type InboxNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inbox'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Props = Omit<BottomTabScreenProps<MainTabParamList, 'Inbox'>, 'navigation'> & {
  navigation: InboxNavigationProp;
};

interface ConversationItemProps {
  item: Conversation;
  anim: Animated.Value | undefined;
  navigation: InboxNavigationProp;
}

const ANIM_INPUT_RANGE: number[] = [0, 1];
const ANIM_OUTPUT_RANGE: number[] = [20, 0];

const ConversationItem = React.memo(({ item, anim, navigation }: ConversationItemProps) => {
  const onPress = useCallback(() => navigation.navigate('Conversation', {
    otherUserId: item.id,
    otherUserName: item.otherUser.display_name || 'Utilisateur',
    otherUserAvatarUrl: item.otherUser.avatar_url,
  }), [navigation, item.id, item.otherUser.display_name, item.otherUser.avatar_url]);
  const isBot = item.id === FLAG_BOT_ID;
  const hasUnread = item.unreadCount > 0;

  const animatedStyle = React.useMemo(
    () =>
      anim
        ? {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: ANIM_INPUT_RANGE, outputRange: ANIM_OUTPUT_RANGE }) }],
          }
        : {},
    [anim],
  );

  return (
    <Animated.View style={[styles.conversationContainer, animatedStyle]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <GlassCard
          withBorder={hasUnread}
          withGlow={hasUnread && !isBot}
          glowColor={isBot ? 'cyan' : 'violet'}
          style={isBot ? [styles.conversationCard, styles.botCard] : styles.conversationCard}
        >
          <View style={styles.conversationLayout}>
            <PremiumAvatar
              uri={item.otherUser.avatar_url}
              name={item.otherUser.display_name}
              size="medium"
              withRing={hasUnread}
              ringColor={isBot ? 'cyan' : 'gradient'}
              withGlow={hasUnread}
              glowColor={isBot ? 'cyan' : 'violet'}
              isBot={isBot}
            />
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={[styles.userName, hasUnread && styles.userNameUnread]}>
                  {item.otherUser.display_name || 'Utilisateur'}
                </Text>
                <Text style={[styles.date, hasUnread && styles.dateUnread]}>
                  {formatMessageDate(item.lastMessage.created_at)}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
                  {getMessagePreview(item)}
                </Text>
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Ionicons name="eye-off" size={12} color={colors.text.primary} />
                    <Text style={styles.unreadCount}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
});

const getMessagePreview = (conversation: Conversation) => {
  const { lastMessage } = conversation;
  const isDeleted = lastMessage.is_from_me
    ? !!lastMessage.deleted_by_sender
    : !!lastMessage.deleted_by_recipient;
  if (isDeleted) return 'Message supprimé';
  const isUndiscovered = !lastMessage.is_from_me && !lastMessage.is_read;
  if (isUndiscovered) return 'Nouveau message à découvrir';
  const prefix = lastMessage.is_from_me ? 'Vous: ' : '';
  switch (lastMessage.content_type) {
    case 'photo': return `${prefix}Photo`;
    case 'audio': return `${prefix}Audio`;
    default: {
      const text = lastMessage.text_content || '';
      const truncated = text.length > 40 ? text.substring(0, 40) + '...' : text;
      return `${prefix}${truncated}`;
    }
  }
};

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [itemAnimations] = useState<Animated.Value[]>([]);

  useEffect(() => {
    log('InboxScreen', 'useEffect[user] fired, user =', user?.id);
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      log('InboxScreen', 'focus event fired');
      loadConversations();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          log('InboxScreen', 'realtime: new message received');
          loadConversations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadConversations = async () => {
    log('InboxScreen', 'loadConversations: START');

    if (conversations.length === 0) {
      const cached = await getCachedConversations();
      if (cached && cached.length > 0) {
        log('InboxScreen', 'showing', cached.length, 'cached conversations');
        setConversations(cached);
      }
    }

    try {
      const data = await fetchConversations();
      log('InboxScreen', 'loadConversations: got', data.length, 'conversations');
      setConversations(data);

      const newAnimations = data.map(() => new Animated.Value(1));
      itemAnimations.splice(0, itemAnimations.length, ...newAnimations);
    } catch (error) {
      if (conversations.length === 0) setConversations([]);
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

  const navigateToSelectRecipient = useCallback(() => navigation.navigate('SelectRecipient', { mode: 'chat' }), [navigation]);

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  const emptyAction = useMemo(
    () => ({ label: 'Nouvelle conversation', onPress: navigateToSelectRecipient }),
    [navigateToSelectRecipient],
  );

  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => (
    <ConversationItem item={item} anim={itemAnimations[index]} navigation={navigation} />
  ), [itemAnimations, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer} />
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.headerGradient} />

      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={navigateToSelectRecipient}
        >
          <View style={styles.newMessageButtonInner}>
            <Ionicons name="create-outline" size={24} color={colors.primary.cyan} />
          </View>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Aucune conversation"
          subtitle="Commencez une conversation en appuyant sur le bouton +"
          action={emptyAction}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.cyan} />
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
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(124, 92, 252, 0.03)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  newMessageButton: {
    padding: spacing.sm,
  },
  newMessageButtonInner: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  conversationContainer: {
    marginBottom: 0,
  },
  conversationCard: {
    padding: 0,
  },
  botCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
  },
  conversationLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    paddingVertical: spacing.xs,
  },
  conversationContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  userNameUnread: {
    fontWeight: '700',
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  dateUnread: {
    color: colors.primary.cyan,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  previewUnread: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary.cyan,
    ...shadows.glow,
  },
  unreadCount: {
    color: colors.text.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
});
