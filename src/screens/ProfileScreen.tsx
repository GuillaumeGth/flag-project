import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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
import { fetchFollowerCount } from '@/services/subscriptions';
import { fetchReceivedRequestsCount } from '@/services/followRequests';
import { Message, MainTabParamList, RootStackParamList } from '@/types';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import GridCell from '@/components/profile/GridCell';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';
import EmptyState from '@/components/EmptyState';
import { useProfileMessages } from '@/hooks/useProfileMessages';

type ProfileNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Props = Omit<BottomTabScreenProps<MainTabParamList, 'Profile'>, 'navigation'> & {
  navigation: ProfileNavigationProp;
};

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateAvatar } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { messages, commentCounts, loading: messagesLoading, refreshing: messagesRefreshing, onRefresh: refreshMessages } = useProfileMessages();
  const [followerCount, setFollowerCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [extraLoading, setExtraLoading] = useState(true);

  const loading = messagesLoading || extraLoading;

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
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
    Promise.all([loadFollowerCount(), loadPendingRequests()]).finally(() => setExtraLoading(false));
  }, [loadFollowerCount, loadPendingRequests]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshMessages(), loadFollowerCount(), loadPendingRequests()]);
  }, [refreshMessages, loadFollowerCount, loadPendingRequests]);

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
      <EmptyState
        icon="albums-outline"
        title="Aucun message public"
        subtitle="Partagez votre premier message avec le monde"
      />
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
          <Text style={styles.displayName}>{user?.display_name || 'Utilisateur'}</Text>
          <Text style={styles.identifier}>{user?.phone || ''}</Text>
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
            <RefreshControl refreshing={messagesRefreshing} onRefresh={onRefresh} tintColor={colors.primary.cyan} />
          }
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.gridRow}
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
  displayName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
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
});
