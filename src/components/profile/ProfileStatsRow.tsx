import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import { fetchFollowers, FollowerUser } from '@/services/subscriptions';
import BottomSheet from '@/components/BottomSheet';

/**
 * Hook that manages the sheets state. Returns:
 * - openCities / openFollowers: pass to <ProfileStatsRow />
 * - renderOverlay: call inside the screen container (outside FlatList) to render the sheet
 */
export function useProfileSheets({
  cityNames = [] as string[],
  userId,
  onPressFollower,
}: {
  cityNames?: string[];
  userId?: string;
  onPressFollower?: (followerId: string) => void;
}) {
  const [showCities, setShowCities] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  const openCities = useCallback(() => {
    if (cityNames.length > 0) setShowCities(true);
  }, [cityNames.length]);

  const openFollowers = useCallback(async () => {
    if (!userId) return;
    setShowFollowers(true);
    setLoadingFollowers(true);
    const data = await fetchFollowers(userId);
    setFollowers(data);
    setLoadingFollowers(false);
  }, [userId]);

  const renderOverlay = () => (
    <>
      <BottomSheet visible={showFollowers} onClose={() => setShowFollowers(false)}>
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
      </BottomSheet>

      <BottomSheet visible={showCities} onClose={() => setShowCities(false)}>
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
      </BottomSheet>
    </>
  );

  return { openCities, openFollowers, renderOverlay };
}

export default function ProfileStatsRow({
  messagesCount,
  followerCount,
  locationsCount,
  onOpenCities,
  onOpenFollowers,
}: {
  messagesCount: number;
  followerCount: number;
  locationsCount: number;
  onOpenCities?: () => void;
  onOpenFollowers?: () => void;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Ionicons name="images" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{messagesCount}</Text>
      </View>
      <TouchableOpacity
        style={styles.statCard}
        onPress={onOpenFollowers}
        activeOpacity={followerCount > 0 ? 0.7 : 1}
      >
        <Ionicons name="people" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{followerCount}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.statCard}
        onPress={onOpenCities}
        activeOpacity={locationsCount > 0 ? 0.7 : 1}
      >
        <Ionicons name="location" size={18} color={colors.primary.cyan} />
        <Text style={styles.statNumber}>{locationsCount}</Text>
      </TouchableOpacity>
    </View>
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
