import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme-redesign';
import { supabase } from '@/services/supabase';
import { fetchUserPublicMessages, fetchMyPublicMessages, fetchDiscoveredPublicMessageIds } from '@/services/messages';
import { useAuth } from '@/contexts/AuthContext';
import { Message, User, RootStackParamList } from '@/types';
import MessageFeedItem from '@/components/comments/MessageFeedItem';

type Props = NativeStackScreenProps<RootStackParamList, 'MessageFeed'>;

export default function MessageFeedScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userId, initialMessageId } = route.params;
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolledToInitial, setScrolledToInitial] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    async function load() {
      const [msgs, profile] = await Promise.all([
        isOwnProfile ? fetchMyPublicMessages() : fetchUserPublicMessages(userId),
        isOwnProfile
          ? Promise.resolve(user as User)
          : supabase.from('users').select('*').eq('id', userId).single().then(r => r.data),
      ]);
      setMessages(msgs);
      if (profile) setUserProfile(profile);
      if (!isOwnProfile && msgs.length > 0) {
        const ids = await fetchDiscoveredPublicMessageIds(msgs.map(m => m.id));
        setDiscoveredIds(ids);
      }
      setLoading(false);
    }
    load();
  }, [userId, isOwnProfile, user]);

  // Scroll to initial message once data is loaded
  useEffect(() => {
    if (!loading && messages.length > 0 && !scrolledToInitial) {
      const index = messages.findIndex(m => m.id === initialMessageId);
      if (index > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
      setScrolledToInitial(true);
    }
  }, [loading, messages, initialMessageId, scrolledToInitial]);

  const handleUserPress = useCallback((pressedUserId: string) => {
    if (pressedUserId !== userId) {
      navigation.push('UserProfile', { userId: pressedUserId });
    }
  }, [navigation, userId]);

  const handleMapPress = useCallback((message: Message) => {
    const { latitude, longitude } = message.location;
    navigation.navigate('Main', {
      screen: 'Map',
      params: { focusLocation: { latitude, longitude } },
    });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageFeedItem
      message={item}
      senderName={userProfile?.display_name ?? undefined}
      senderAvatarUrl={userProfile?.avatar_url}
      isDiscovered={isOwnProfile ? undefined : discoveredIds.has(item.id)}
      onUserPress={handleUserPress}
      onMapPress={() => handleMapPress(item)}
    />
  ), [userProfile, discoveredIds, isOwnProfile, handleUserPress, handleMapPress]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {userProfile?.display_name || 'Publications'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary.violet} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.background.primary }}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 200);
          }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
});
