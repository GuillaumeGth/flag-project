import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchReceivedRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  FollowRequest,
} from '@/services/followRequests';
import { colors, radius, spacing, typography } from '@/theme-redesign';
import { RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowRequests'>;

export default function FollowRequestsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchReceivedRequests();
    setRequests(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleAccept = async (request: FollowRequest) => {
    setActionLoading(request.id);
    const ok = await acceptFollowRequest(request);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    }
    setActionLoading(null);
  };

  const handleReject = async (request: FollowRequest) => {
    setActionLoading(request.id);
    const ok = await rejectFollowRequest(request.id);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    }
    setActionLoading(null);
  };

  const renderItem = ({ item }: { item: FollowRequest }) => {
    const isProcessing = actionLoading === item.id;
    const requester = item.requester;

    return (
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: item.requester_id })}
          style={styles.userInfo}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {requester?.avatar_url ? (
              <Image source={{ uri: requester.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color={colors.text.secondary} />
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {requester?.display_name || 'Utilisateur'}
          </Text>
        </TouchableOpacity>

        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.primary.violet} style={styles.loader} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleReject(item)}
            >
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.acceptText}>Accepter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Demandes d'abonnement</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary.violet}
          style={styles.fullLoader}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.violet}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>Aucune demande en attente</Text>
            </View>
          }
          contentContainerStyle={requests.length === 0 && styles.emptyContainer}
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  fullLoader: {
    marginTop: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: spacing.sm,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  loader: {
    marginHorizontal: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary.violet,
  },
  acceptText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
