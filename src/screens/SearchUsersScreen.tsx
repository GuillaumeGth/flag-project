import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCachedUserId } from '@/services/supabase';
import { colors } from '@/theme-redesign';
import { User, MainTabParamList, RootStackParamList } from '@/types';
import { maskEmail } from '@/utils/privacy';

type SearchNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Props = Omit<BottomTabScreenProps<MainTabParamList, 'Search'>, 'navigation'> & {
  navigation: SearchNavigationProp;
};

export default function SearchUsersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = getCachedUserId();

  useEffect(() => {
    supabase
      .rpc('get_top_users_by_followers', {
        limit_count: 10,
        exclude_user_id: currentUserId || undefined,
      })
      .then(({ data }) => {
        if (data) setTopUsers(data);
      });
  }, [currentUserId]);

  const search = useCallback(async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('display_name', `%${text.trim()}%`)
      .neq('id', currentUserId || '')
      .eq('is_searchable', true)
      .limit(20)
      .order('display_name', { ascending: true });

    if (!error && data) {
      setResults(data);
    }
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const isSearching = query.trim().length > 0;
  const displayedData = isSearching ? results : topUsers;

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.userAvatarImage} />
        ) : (
          <Ionicons name="person" size={20} color={colors.text.secondary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.display_name || 'Utilisateur'}</Text>
        {(item.phone || item.email) && (
          <Text style={styles.userIdentifier}>{item.phone || (item.email ? maskEmail(item.email) : '')}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && results.length === 0 && (
        <ActivityIndicator size="small" color={colors.primary.cyan} style={styles.loader} />
      )}

      <FlatList
        data={displayedData}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        ListHeaderComponent={
          !isSearching && topUsers.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={14} color={colors.text.tertiary} />
              <Text style={styles.sectionHeaderText}>Populaires</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isSearching && !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
            </View>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glassDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 8,
    paddingVertical: 0,
  },
  loader: {
    marginTop: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  userIdentifier: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background.primary,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
