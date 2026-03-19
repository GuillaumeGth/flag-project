import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, shadows } from '@/theme-redesign';
import { supabase } from '@/services/supabase';
import { fetchUserPublicMessages, fetchDiscoveredPublicMessageIds } from '@/services/messages';
import {
  follow,
  unfollow,
  isFollowing,
  fetchFollowerCount,
  fetchNotificationPrefs,
  updateNotificationPrefs,
  NotificationPrefs,
} from '@/services/subscriptions';
import {
  sendFollowRequest,
  cancelFollowRequest,
  fetchSentRequestStatus,
} from '@/services/followRequests';
import { fetchCommentCounts } from '@/services/comments';
import { Message, User, RootStackParamList } from '@/types';
import GridCell from '@/components/profile/GridCell';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { userId } = route.params;

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [followerCount, setFollowerCount] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({ notifyPrivateFlags: true, notifyPublicFlags: false });
  const [showNotifModal, setShowNotifModal] = useState(false);

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
    if (data.length > 0) {
      const [ids, counts] = await Promise.all([
        fetchDiscoveredPublicMessageIds(data.map(m => m.id)),
        fetchCommentCounts(data.map(m => m.id)),
      ]);
      setDiscoveredIds(ids);
      setCommentCounts(counts);
    }
  }, [userId]);

  const checkFollowing = useCallback(async () => {
    const result = await isFollowing(userId);
    setFollowing(result);
    if (result) {
      const prefs = await fetchNotificationPrefs(userId);
      setNotifPrefs(prefs);
    } else {
      const req = await fetchSentRequestStatus(userId);
      setPendingRequestId(req?.status === 'pending' ? req.id : null);
    }
  }, [userId]);

  const loadFollowerCount = useCallback(async () => {
    const count = await fetchFollowerCount(userId);
    setFollowerCount(count);
  }, [userId]);

  useEffect(() => {
    Promise.all([loadProfile(), loadMessages(), checkFollowing(), loadFollowerCount()])
      .finally(() => setLoading(false));
  }, [loadProfile, loadMessages, checkFollowing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(), checkFollowing(), loadFollowerCount()]);
    setRefreshing(false);
  }, [loadMessages, checkFollowing, loadFollowerCount]);

  const handleToggleFollow = async () => {
    setFollowLoading(true);

    if (following) {
      // Unfollow
      const ok = await unfollow(userId);
      if (ok) {
        setFollowing(false);
        setFollowerCount(c => Math.max(0, c - 1));
        setNotifPrefs({ notifyPrivateFlags: true, notifyPublicFlags: false });
      }
    } else if (pendingRequestId) {
      // Cancel pending request
      const ok = await cancelFollowRequest(pendingRequestId);
      if (ok) setPendingRequestId(null);
    } else if (userProfile?.is_private) {
      // Send follow request to private account
      const id = await sendFollowRequest(userId);
      if (id) setPendingRequestId(id);
    } else {
      // Direct follow for public account
      const ok = await follow(userId);
      if (ok) {
        setFollowing(true);
        setFollowerCount(c => c + 1);
        const prefs = await fetchNotificationPrefs(userId);
        setNotifPrefs(prefs);
      }
    }

    setFollowLoading(false);
  };

  const handleCellPress = useCallback((message: Message) => {
    navigation.navigate('MessageFeed', { userId, initialMessageId: message.id });
  }, [navigation, userId]);

  const handleUndiscoveredPress = useCallback((message: Message) => {
    const loc = message.location;
    if (loc && typeof loc === 'object' && 'latitude' in loc) {
      navigation.navigate('Main', {
        screen: 'Map',
        params: { focusLocation: { latitude: loc.latitude, longitude: loc.longitude } },
      });
    }
  }, [navigation]);

  const renderCell = ({ item, index }: { item: Message; index: number }) => (
    <GridCell
      item={item}
      index={index}
      onPress={handleCellPress}
      commentCount={commentCounts[item.id]}
      discovered={discoveredIds.has(item.id)}
      onUndiscoveredPress={handleUndiscoveredPress}
    />
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="albums-outline"
          size={48}
          color={colors.text.tertiary}
        />
        <Text style={styles.emptyText}>Aucun message public</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.profileSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatar}>
              {userProfile?.avatar_url ? (
                <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color={colors.text.secondary} />
              )}
            </View>
            <Text style={styles.displayName}>
              {userProfile?.display_name || 'Utilisateur'}
            </Text>
          </View>
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => navigation.navigate('Conversation', {
                otherUserId: userId,
                otherUserName: userProfile?.display_name || 'Utilisateur',
                otherUserAvatarUrl: userProfile?.avatar_url,
              })}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary.violet} />
            </TouchableOpacity>
            {following && (
              <TouchableOpacity onPress={() => setShowNotifModal(true)} style={styles.bellButton}>
                <Ionicons
                  name={notifPrefs.notifyPrivateFlags || notifPrefs.notifyPublicFlags ? 'notifications' : 'notifications-off'}
                  size={20}
                  color={colors.primary.violet}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.followButton,
                (following || !!pendingRequestId) && styles.followButtonActive,
              ]}
              onPress={handleToggleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator
                  size="small"
                  color={following || pendingRequestId ? colors.primary.violet : colors.text.primary}
                />
              ) : (
                <Text
                  style={[
                    styles.followButtonText,
                    (following || !!pendingRequestId) && styles.followButtonTextActive,
                  ]}
                >
                  {following
                    ? 'Abonné'
                    : pendingRequestId
                      ? 'Demande envoyée'
                      : userProfile?.is_private
                        ? 'Demander'
                        : "S'abonner"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ProfileStatsRow
        messagesCount={messages.length}
        followerCount={followerCount}
        locationsCount={messages.length}
      />

      <View style={styles.divider} />
    </>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerSpacer, { paddingTop: insets.top }]} />

      {loading ? (
        <>
          {renderHeader()}
          <ActivityIndicator size="large" color={colors.primary.violet} style={{ marginTop: 32 }} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.violet} />
          }
        />
      )}

      <Modal
        visible={showNotifModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <TouchableOpacity
          style={styles.notifModalOverlay}
          activeOpacity={1}
          onPress={() => setShowNotifModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.notifModalCard}>
            <View style={styles.notifModalHeader}>
              <Text style={styles.notifModalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.notifRow}>
              <View style={styles.notifRowInfo}>
                <Text style={styles.notifRowLabel}>Fläags privés</Text>
              </View>
              <Switch
                value={notifPrefs.notifyPrivateFlags}
                onValueChange={async (val) => {
                  const newPrefs = { ...notifPrefs, notifyPrivateFlags: val };
                  setNotifPrefs(newPrefs);
                  await updateNotificationPrefs(userId, { notifyPrivateFlags: val });
                }}
                trackColor={{ false: colors.border.default, true: colors.primary.violet }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.notifDivider} />

            <View style={styles.notifRow}>
              <View style={styles.notifRowInfo}>
                <Text style={styles.notifRowLabel}>Fläags publics</Text>
              </View>
              <Switch
                value={notifPrefs.notifyPublicFlags}
                onValueChange={async (val) => {
                  const newPrefs = { ...notifPrefs, notifyPublicFlags: val };
                  setNotifPrefs(newPrefs);
                  await updateNotificationPrefs(userId, { notifyPublicFlags: val });
                }}
                trackColor={{ false: colors.border.default, true: colors.primary.violet }}
                thumbColor={colors.text.primary}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerSpacer: {},
  backButton: {
    padding: 4,
    marginRight: 4,
    marginTop: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  followerCount: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary.violet,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary.violet,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  followButtonTextActive: {
    color: colors.primary.violet,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  gridTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  notifModalCard: {
    width: '100%',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  notifModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  notifModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  notifRowInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  notifRowLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  notifRowDesc: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  notifDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
});
