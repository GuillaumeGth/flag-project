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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCachedUserId } from '@/services/supabase';
import { colors } from '@/theme';
import { User } from '@/types';

interface Props {
  navigation: any;
}

export default function SearchUsersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = getCachedUserId();

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
          <Ionicons name="person" size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.display_name || 'Utilisateur'}</Text>
        {(item.phone || item.email) && (
          <Text style={styles.userIdentifier}>{item.phone || item.email}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && results.length === 0 && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      )}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        ListEmptyComponent={
          query.trim().length > 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
            </View>
          ) : !query.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Recherchez par nom</Text>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
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
    borderBottomColor: colors.border,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
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
    color: colors.textPrimary,
  },
  userIdentifier: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
