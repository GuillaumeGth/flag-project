import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import { fetchMyPublicMessages } from '@/services/messages';
import { fetchFollowerCount } from '@/services/subscriptions';
import { fetchReceivedRequestsCount } from '@/services/followRequests';
import { fetchCommentCounts } from '@/services/comments';
import { Message, MainTabParamList, RootStackParamList } from '@/types';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumButton from '@/components/redesign/PremiumButton';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import GridCell from '@/components/profile/GridCell';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';

type ProfileNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Props = Omit<BottomTabScreenProps<MainTabParamList, 'Profile'>, 'navigation'> & {
  navigation: ProfileNavigationProp;
};

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateAvatar, updateDisplayName } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadMessages = useCallback(async () => {
    const data = await fetchMyPublicMessages();
    setMessages(data);
    if (data.length > 0) {
      const counts = await fetchCommentCounts(data.map(m => m.id));
      setCommentCounts(counts);
    }
  }, []);

  const loadFollowerCount = useCallback(async () => {
    if (!user?.id) return;
    const count = await fetchFollowerCount(user.id);
    setFollowerCount(count);
  }, [user?.id]);

  const loadPendingRequests = useCallback(async () => {
    const count = await fetchReceivedRequestsCount();
    setPendingRequestsCount(count);
  }, []);

  useEffect(() => {
    Promise.all([loadMessages(), loadFollowerCount(), loadPendingRequests()]).finally(() => setLoading(false));
  }, [loadMessages, loadFollowerCount, loadPendingRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(), loadFollowerCount(), loadPendingRequests()]);
    setRefreshing(false);
  }, [loadMessages, loadFollowerCount, loadPendingRequests]);

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      await updateAvatar(result.assets[0].uri);
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    await updateDisplayName(newName.trim());
    setSavingName(false);
    setEditNameVisible(false);
  };

  const handleCellPress = useCallback((message: Message) => {
    if (!user?.id) return;
    navigation.navigate('MessageFeed', { userId: user.id, initialMessageId: message.id });
  }, [navigation, user?.id]);

  const renderCell = ({ item, index }: { item: Message; index: number }) => (
    <GridCell
      item={item}
      index={index}
      onPress={handleCellPress}
      commentCount={commentCounts[item.id]}
    />
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="albums-outline" size={56} color={colors.primary.violet} />
        </View>
        <Text style={styles.emptyText}>Aucun message public</Text>
        <Text style={styles.emptySubtext}>Partagez votre premier message avec le monde</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={['rgba(124, 92, 252, 0.08)', 'transparent']}
        style={styles.headerGradient}
      />

      <View style={styles.topButtons}>
        {pendingRequestsCount > 0 && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('FollowRequests')}
          >
            <View style={styles.settingsButtonInner}>
              <Ionicons name="people-outline" size={22} color={colors.text.primary} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
          <View style={styles.settingsButtonInner}>
            <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.profileRow}>
        <TouchableOpacity onPress={handleChangeAvatar} disabled={uploading}>
          {uploading ? (
            <View style={styles.avatarLoading} />
          ) : (
            <PremiumAvatar uri={user?.avatar_url} name={user?.display_name} size="large" withRing withGlow ringColor="gradient" glowColor="violet" />
          )}
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <TouchableOpacity
            onPress={() => { setNewName(user?.display_name || ''); setEditNameVisible(true); }}
            style={styles.nameContainer}
          >
            <Text style={styles.displayName}>{user?.display_name || 'Utilisateur'}</Text>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={12} color={colors.text.primary} />
            </View>
          </TouchableOpacity>
          <Text style={styles.identifier}>{user?.phone || user?.email || ''}</Text>
        </View>
      </View>

      <ProfileStatsRow
        messagesCount={messages.length}
        followerCount={followerCount}
        locationsCount={messages.length}
      />

      <View style={styles.divider} />
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading ? (
        <>
          {renderHeader()}
        </>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderCell}
          keyExtractor={(item) => item.id}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.cyan} />
          }
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      <Modal visible={editNameVisible} transparent animationType="fade" onRequestClose={() => setEditNameVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBlur} />
          <GlassCard style={styles.modalCard} withBorder withGlow glowColor="cyan">
            <Text style={styles.modalTitle}>Modifier le nom</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Votre nom"
                placeholderTextColor={colors.text.tertiary}
                autoFocus
                maxLength={50}
              />
            </View>
            <View style={styles.modalButtons}>
              <PremiumButton title="Annuler" variant="ghost" onPress={() => setEditNameVisible(false)} disabled={savingName} style={styles.modalButton} />
              <PremiumButton title="Enregistrer" variant="gradient" onPress={handleSaveName} loading={savingName} disabled={savingName} style={styles.modalButton} withGlow />
            </View>
          </GlassCard>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  listContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 8,
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  topButtons: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingsButton: {},
  settingsButtonInner: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  avatarLoading: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface.glass,
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  displayName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  editBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primary.cyan,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glow,
  },
  identifier: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  gridRow: {
    gap: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.glowViolet,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay.dark,
  },
  modalBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalCard: {
    width: '85%',
    maxWidth: 400,
    padding: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    backgroundColor: colors.surface.glassDark,
    color: colors.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
