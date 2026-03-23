import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import { colors } from '@/theme-redesign';
import styles, { CELL_SIZE } from './UserProfileScreen.styles';
import { supabase } from '@/services/supabase';
import { fetchUserPublicMessages, fetchDiscoveredPublicMessageIds, deletePublicMessage } from '@/services/messages';
import { fetchReactionsForMessages, toggleReaction } from '@/services/reactions';
import { ReactionSummary } from '@/types/reactions';
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
import { useAuth } from '@/contexts/AuthContext';
import Toast from '@/components/Toast';
import OptionsModal from '@/components/OptionsModal';


type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
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
  const [viewingReactions, setViewingReactions] = useState<ReactionSummary[]>([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
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

  const handleOpenMessage = useCallback(async (msg: Message) => {
    setViewingMessage(msg);
    setViewingReactions([]);
    if (!currentUser?.id) return;
    const map = await fetchReactionsForMessages([msg.id], currentUser.id);
    setViewingReactions(map[msg.id] ?? []);
  }, [currentUser?.id]);

  const handleLikeViewing = useCallback(async () => {
    if (!viewingMessage || !currentUser?.id) return;
    const heart = viewingReactions.find(r => r.emoji === '❤️');
    const hasReacted = heart?.has_reacted ?? false;
    setViewingReactions(prev => {
      const idx = prev.findIndex(r => r.emoji === '❤️');
      if (idx === -1) {
        return [...prev, { emoji: '❤️', count: 1, has_reacted: true, user_ids: [currentUser.id] }];
      }
      const entry = prev[idx];
      const updated = [...prev];
      updated[idx] = hasReacted
        ? { ...entry, count: entry.count - 1, has_reacted: false, user_ids: entry.user_ids.filter(id => id !== currentUser.id) }
        : { ...entry, count: entry.count + 1, has_reacted: true, user_ids: [...entry.user_ids, currentUser.id] };
      return updated;
    });
    await toggleReaction(viewingMessage.id, '❤️', currentUser.id, hasReacted);
  }, [viewingMessage, viewingReactions, currentUser?.id]);

  const handleDeleteViewing = useCallback(async () => {
    if (!viewingMessage) return;
    setShowOptionsModal(false);
    const ok = await deletePublicMessage(viewingMessage.id);
    if (ok) {
      setMessages(prev => prev.filter(m => m.id !== viewingMessage.id));
      setViewingMessage(null);
    } else {
      setToast({ message: 'Impossible de supprimer ce message.', type: 'error' });
    }
  }, [viewingMessage]);

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
        <TouchableOpacity style={styles.cell} onPress={() => handleOpenMessage(item)}>
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
      <TouchableOpacity style={[styles.cell, styles.cellPlaceholder]} onPress={() => handleOpenMessage(item)}>
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
      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'error'}
        onHide={() => setToast(null)}
      />
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
          {/* Like + ellipsis footer */}
          <View style={[styles.viewerFooter, { bottom: (viewingMessage?.location ? 80 : 32) + insets.bottom }]}>
            <TouchableOpacity style={styles.viewerLikeButton} onPress={handleLikeViewing}>
              <Ionicons
                name={viewingReactions.find(r => r.emoji === '❤️')?.has_reacted ? 'heart' : 'heart-outline'}
                size={26}
                color={viewingReactions.find(r => r.emoji === '❤️')?.has_reacted ? '#FF5C7C' : colors.text.primary}
              />
              {(viewingReactions.find(r => r.emoji === '❤️')?.count ?? 0) > 0 && (
                <Text style={[
                  styles.viewerLikeCount,
                  viewingReactions.find(r => r.emoji === '❤️')?.has_reacted && styles.viewerLikeCountActive,
                ]}>
                  {viewingReactions.find(r => r.emoji === '❤️')?.count}
                </Text>
              )}
            </TouchableOpacity>
            {currentUser?.id === userId && (
              <TouchableOpacity style={styles.viewerEllipsisButton} onPress={() => setShowOptionsModal(true)}>
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
      <OptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        options={[
          { label: 'Supprimer', icon: 'trash-outline', destructive: true, onPress: handleDeleteViewing },
        ]}
      />
    </View>
  );
}

