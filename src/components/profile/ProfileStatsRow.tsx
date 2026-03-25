import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import { fetchFollowers, FollowerUser } from '@/services/subscriptions';

interface ProfileStatsRowProps {
  messagesCount: number;
  followerCount: number;
  locationsCount: number;
  cityNames?: string[];
  userId?: string;
  onPressFollower?: (followerId: string) => void;
}

export default function ProfileStatsRow({
  messagesCount,
  followerCount,
  locationsCount,
  cityNames = [],
  userId,
  onPressFollower,
}: ProfileStatsRowProps) {
  const [showCities, setShowCities] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const insets = useSafeAreaInsets();

  const handleFollowerPress = async () => {
    if (!userId || followerCount === 0) return;
    setShowFollowers(true);
    setLoadingFollowers(true);
    const data = await fetchFollowers(userId);
    setFollowers(data);
    setLoadingFollowers(false);
  };

  return (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="images" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{messagesCount}</Text>
        </View>
        <TouchableOpacity
          style={styles.statCard}
          onPress={handleFollowerPress}
          activeOpacity={followerCount > 0 ? 0.7 : 1}
        >
          <Ionicons name="people" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{followerCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => cityNames.length > 0 && setShowCities(true)}
          activeOpacity={cityNames.length > 0 ? 0.7 : 1}
        >
          <Ionicons name="location" size={18} color={colors.primary.cyan} />
          <Text style={styles.statNumber}>{locationsCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Followers bottom sheet */}
      <Modal
        visible={showFollowers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFollowers(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowFollowers(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Connexions</Text>
          {loadingFollowers ? (
            <ActivityIndicator color={colors.primary.cyan} style={{ marginVertical: spacing.xl }} />
          ) : (
            <FlatList
              data={followers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => {
                    setShowFollowers(false);
                    onPressFollower?.(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={18} color={colors.text.secondary} />
                    </View>
                  )}
                  <Text style={styles.userName}>{item.display_name || 'Utilisateur'}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aucune connexion pour le moment</Text>
              }
            />
          )}
        </View>
      </Modal>

      {/* Cities bottom sheet */}
      <Modal
        visible={showCities}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCities(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowCities(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Villes visitées</Text>
          <FlatList
            data={cityNames}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View style={styles.cityRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary.cyan} />
                <Text style={styles.cityName}>{item}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.background.secondary ?? colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: '60%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface.glass,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surface.glass,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cityName: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
});
