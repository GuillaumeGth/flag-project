import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFollowedUsers, FLAG_BOT_ID } from '@/services/messages';
import { User, RootStackParamList } from '@/types';
import { colors } from '@/theme-redesign';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectRecipient'>;

export default function SelectRecipientScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const mode = route.params.mode;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const followedUsers = await fetchFollowedUsers();
    setUsers(followedUsers);
    setLoading(false);
  };

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const confirmSelection = () => {
    const recipients = selectedUsers.map((u) => ({
      id: u.id,
      name: u.display_name || u.email || u.phone || 'Utilisateur',
    }));
    navigation.navigate('CreateMessage', { recipients });
  };

  const handlePress = (user: User) => {
    if (mode === 'flag') {
      toggleUser(user);
    } else {
      const displayName = user.display_name || user.email || user.phone || 'Utilisateur';
      navigation.navigate('Conversation', {
        otherUserId: user.id,
        otherUserName: displayName,
        otherUserAvatarUrl: user.avatar_url ?? undefined,
      });
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isBot = item.id === FLAG_BOT_ID;
    const displayName = item.display_name || item.email || item.phone || 'Utilisateur';
    const isSelected = selectedUsers.some((u) => u.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => handlePress(item)}
      >
        {mode === 'flag' && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        )}
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, isBot && styles.botAvatar]}>
            <Ionicons
              name={isBot ? 'flag' : 'person'}
              size={24}
              color={isBot ? '#4A90D9' : '#666'}
            />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          {isBot && <Text style={styles.botLabel}>Bot officiel Fläag</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'flag' ? 'Choisir les destinataires' : 'Nouvelle conversation'}</Text>
        {mode === 'flag' ? (
          <TouchableOpacity onPress={confirmSelection} disabled={selectedUsers.length === 0}>
            <Text style={[styles.confirmButton, selectedUsers.length === 0 && styles.confirmButtonDisabled]}>
              OK ({selectedUsers.length})
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.cyan} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>Aucun abonnement</Text>
          <Text style={styles.emptyText}>
            Vous ne suivez personne pour le moment.{'\n'}
            Abonnez-vous à des utilisateurs pour leur envoyer des messages !
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
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
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  confirmButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.cyan,
  },
  confirmButtonDisabled: {
    color: colors.text.tertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    marginBottom: 8,
  },
  userItemSelected: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.primary.cyan,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.text.tertiary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary.cyan,
    borderColor: colors.primary.cyan,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  botAvatar: {
    backgroundColor: colors.background.tertiary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  botLabel: {
    fontSize: 12,
    color: colors.primary.cyan,
    marginTop: 2,
  },
});
