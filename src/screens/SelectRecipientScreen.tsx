import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAllUsers, FLAG_BOT_ID } from '@/services/messages';
import { User } from '@/types';

interface Props {
  navigation: any;
}

export default function SelectRecipientScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const allUsers = await fetchAllUsers();
    setUsers(allUsers);
    setLoading(false);
  };

  const selectRecipient = (user: User) => {
    navigation.navigate('CreateMessage', {
      recipientId: user.id,
      recipientName: user.display_name || user.email || user.phone || 'Utilisateur',
    });
  };

  const renderUser = ({ item }: { item: User }) => {
    const isBot = item.id === FLAG_BOT_ID;
    const displayName = item.display_name || item.email || item.phone || 'Utilisateur';

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => selectRecipient(item)}
      >
        <View style={[styles.avatar, isBot && styles.botAvatar]}>
          <Ionicons
            name={isBot ? 'flag' : 'person'}
            size={24}
            color={isBot ? '#4A90D9' : '#666'}
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          {isBot && (
            <Text style={styles.botLabel}>Bot officiel Flag</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Choisir un destinataire</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
          <Text style={styles.emptyText}>
            Il n'y a pas encore d'autres utilisateurs.{'\n'}
            Invitez des amis à rejoindre Flag !
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatar: {
    backgroundColor: '#e8f4fd',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  botLabel: {
    fontSize: 12,
    color: '#4A90D9',
    marginTop: 2,
  },
});
