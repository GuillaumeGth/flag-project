import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { supabase } from '@/services/supabase';
import { fetchUserPublicMessages, fetchDiscoveredPublicMessageIds } from '@/services/messages';
import { follow, unfollow, isFollowing } from '@/services/subscriptions';
import { Message, User } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = SCREEN_WIDTH / 3;

interface Props {
  navigation: any;
  route: any;
}

export default function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setUserProfile(data);
  }, [userId]);

  const loadMessages = useCallback(async () => {
    const data = await fetchUserPublicMessages(userId);
    setMessages(data);
    // Fetch which of these the current user has discovered
    if (data.length > 0) {
      const ids = await fetchDiscoveredPublicMessageIds(data.map(m => m.id));
      setDiscoveredIds(ids);
    }
  }, [userId]);

  const checkFollowing = useCallback(async () => {
    const result = await isFollowing(userId);
    setFollowing(result);
  }, [userId]);

  useEffect(() => {
    Promise.all([loadProfile(), loadMessages(), checkFollowing()])
      .finally(() => setLoading(false));
  }, [loadProfile, loadMessages, checkFollowing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(), checkFollowing()]);
    setRefreshing(false);
  }, [loadMessages, checkFollowing]);

  const handleToggleFollow = async () => {
    setFollowLoading(true);
    if (following) {
      const ok = await unfollow(userId);
      if (ok) setFollowing(false);
    } else {
      const ok = await follow(userId);
      if (ok) setFollowing(true);
    }
    setFollowLoading(false);
  };

  const renderCell = ({ item }: { item: Message }) => {
    const isDiscovered = discoveredIds.has(item.id);

    if (!isDiscovered) {
      return (
        <View style={[styles.cell, styles.cellUndiscovered]}>
          {item.content_type === 'photo' && item.media_url && (
            <Image source={{ uri: item.media_url }} style={styles.cellImageBlurred} blurRadius={150} />
          )}
          {item.content_type === 'audio' && (
            <Ionicons name="mic" size={32} color="rgba(107,114,128,0.3)" />
          )}
          {item.content_type === 'text' && item.text_content && (
            <Text style={styles.cellTextBlurred} numberOfLines={4}>
              {'••••••••••••\n••••••••\n••••••••••'}
            </Text>
          )}
          <View style={styles.lockOverlay}>
            <Ionicons name="eye-off" size={40} color="rgba(190,170,255,0.2)" />
          </View>
        </View>
      );
    }

    if (item.content_type === 'photo') {
      return (
        <View style={styles.cell}>
          <Image source={{ uri: item.media_url }} style={styles.cellImage} />
        </View>
      );
    }
    if (item.content_type === 'audio') {
      return (
        <View style={[styles.cell, styles.cellPlaceholder]}>
          <Ionicons name="mic" size={32} color={colors.textMuted} />
        </View>
      );
    }
    return (
      <View style={[styles.cell, styles.cellPlaceholder]}>
        <Text style={styles.cellText} numberOfLines={4}>
          {item.text_content}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="albums-outline"
          size={48}
          color={colors.textMuted}
        />
        <Text style={styles.emptyText}>Aucun message public</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.profileSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {userProfile?.avatar_url ? (
            <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>
            {userProfile?.display_name || 'Utilisateur'}
          </Text>
          <Text style={styles.identifier}>
            {userProfile?.phone || userProfile?.email || ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followButton, following && styles.followButtonActive]}
          onPress={handleToggleFollow}
          disabled={followLoading}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={following ? colors.primary : '#fff'} />
          ) : (
            <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
              {following ? 'Abonn\u00e9' : "S'abonner"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerSpacer} />

      {loading ? (
        <>
          {renderHeader()}
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        </>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderCell}
          keyExtractor={item => item.id}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
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
  headerSpacer: {
    paddingTop: 48,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  identifier: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followButtonTextActive: {
    color: colors.primary,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellImageBlurred: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cellUndiscovered: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cellPlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cellText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  cellTextBlurred: {
    color: 'rgba(107,114,128,0.3)',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
