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
import { Message, User, RootStackParamList } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = SCREEN_WIDTH / 3;

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingMessage, setViewingMessage] = useState<Message | null>(null);
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
    // Fetch which of these the current user has discovered
    if (data.length > 0) {
      const ids = await fetchDiscoveredPublicMessageIds(data.map(m => m.id));
      setDiscoveredIds(ids);
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

  const renderCell = ({ item }: { item: Message }) => {
    const isDiscovered = discoveredIds.has(item.id);

    if (!isDiscovered) {
      return (
        <TouchableOpacity
          style={[styles.cell, styles.cellUndiscovered]}
          onPress={() => {
            const loc = item.location;
            if (loc && typeof loc === 'object' && 'latitude' in loc) {
              navigation.navigate('Main', {
                screen: 'Map',
                params: { focusLocation: { latitude: loc.latitude, longitude: loc.longitude } },
              });
            }
          }}
        >
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
        </TouchableOpacity>
      );
    }

    if (item.content_type === 'photo') {
      return (
        <TouchableOpacity style={styles.cell} onPress={() => setViewingMessage(item)}>
          <Image source={{ uri: item.media_url }} style={styles.cellImage} />
        </TouchableOpacity>
      );
    }
    if (item.content_type === 'audio') {
      return (
        <View style={[styles.cell, styles.cellPlaceholder]}>
          <Ionicons name="mic" size={32} color={colors.text.tertiary} />
        </View>
      );
    }
    return (
      <TouchableOpacity style={[styles.cell, styles.cellPlaceholder]} onPress={() => setViewingMessage(item)}>
        <Text style={styles.cellText} numberOfLines={4}>
          {item.text_content}
        </Text>
      </TouchableOpacity>
    );
  };

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

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="images" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{messages.length}</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="people" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{followerCount}</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="location" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{messages.length}</Text>
        </View>
      </View>

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

      <Modal
        visible={!!viewingMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingMessage(null)}
      >
        <View style={styles.photoViewerOverlay}>
          {viewingMessage?.content_type === 'photo' && viewingMessage?.media_url && (
            <Image
              source={{ uri: viewingMessage.media_url }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
          {viewingMessage?.content_type === 'text' && (
            <View style={styles.textViewerContainer}>
              <Text style={styles.textViewerContent}>{viewingMessage.text_content}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => setViewingMessage(null)}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          {viewingMessage?.location && (
            <TouchableOpacity
              style={styles.photoViewerLocationButton}
              onPress={() => {
                const loc = viewingMessage.location;
                setViewingMessage(null);
                navigation.navigate('Main', {
                  screen: 'Map',
                  params: { focusLocation: loc },
                });
              }}
            >
              <Ionicons name="location" size={20} color={colors.text.primary} />
              <Text style={styles.photoViewerLocationText}>Voir sur la carte</Text>
            </TouchableOpacity>
          )}
        </View>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface.glass,
    borderRadius: radius.lg,
  },
  statNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
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
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: colors.border.default,
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
    backgroundColor: colors.surface.elevated,
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
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cellText: {
    color: colors.text.secondary,
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
    color: colors.text.tertiary,
    fontSize: 14,
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: '100%',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerLocationButton: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,92,252,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  photoViewerLocationText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
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
  textViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  textViewerContent: {
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
});
