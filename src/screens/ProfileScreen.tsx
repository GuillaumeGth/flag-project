import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme';
import { fetchMyPublicMessages } from '@/services/messages';
import { Message } from '@/types';

type TabType = 'photo' | 'audio' | 'text';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = SCREEN_WIDTH / 3;

export default function ProfileScreen({ navigation }: any) {
  const { user, updateAvatar, updateDisplayName } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>('photo');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMessages = useCallback(async () => {
    const data = await fetchMyPublicMessages();
    setMessages(data);
  }, []);

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
  }, [loadMessages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, [loadMessages]);

  const filteredMessages = messages.filter(m => m.content_type === activeTab);

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de la permission pour accéder à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      const { error } = await updateAvatar(result.assets[0].uri);
      setUploading(false);

      if (error) {
        Alert.alert('Erreur', error.message || 'Impossible de mettre à jour votre avatar.');
      }
    }
  };

  const handleEditName = () => {
    setNewName(user?.display_name || '');
    setEditNameVisible(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide.');
      return;
    }

    setSavingName(true);
    const { error } = await updateDisplayName(newName.trim());
    setSavingName(false);

    if (error) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le nom.');
    } else {
      setEditNameVisible(false);
    }
  };

  const renderCell = ({ item }: { item: Message }) => {
    if (item.content_type === 'photo') {
      return (
        <View style={styles.cell}>
          <Image source={{ uri: item.media_url }} style={styles.cellImage} />
        </View>
      );
    }
    if (item.content_type === 'audio') {
      return (
        <View style={[styles.cell, styles.cellPlaceholder]}>
          <Ionicons name="mic" size={32} color={colors.textMuted} />
        </View>
      );
    }
    // text
    return (
      <View style={[styles.cell, styles.cellPlaceholder]}>
        <Text style={styles.cellText} numberOfLines={4}>
          {item.text_content}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={activeTab === 'photo' ? 'image-outline' : activeTab === 'audio' ? 'mic-outline' : 'document-text-outline'}
          size={48}
          color={colors.textMuted}
        />
        <Text style={styles.emptyText}>Aucun message public</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.profileSection}>
        <TouchableOpacity onPress={handleChangeAvatar} disabled={uploading}>
          <View style={styles.avatar}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={24} color={colors.textSecondary} />
            )}
          </View>
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={10} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <TouchableOpacity onPress={handleEditName} style={styles.nameContainer}>
            <Text style={styles.displayName}>
              {user?.display_name || 'Utilisateur'}
            </Text>
            <Ionicons name="pencil" size={14} color={colors.primary} style={styles.editIcon} />
          </TouchableOpacity>
          <Text style={styles.identifier}>
            {user?.phone || user?.email || ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photo' && styles.tabActive]}
          onPress={() => setActiveTab('photo')}
        >
          <Ionicons name="image" size={22} color={activeTab === 'photo' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'audio' && styles.tabActive]}
          onPress={() => setActiveTab('audio')}
        >
          <Ionicons name="mic" size={22} color={activeTab === 'audio' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'text' && styles.tabActive]}
          onPress={() => setActiveTab('text')}
        >
          <Ionicons name="document-text" size={22} color={activeTab === 'text' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerSpacer} />

      {loading ? (
        <>
          {renderHeader()}
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        </>
      ) : (
        <FlatList
          data={filteredMessages}
          renderItem={renderCell}
          keyExtractor={item => item.id}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}

      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le nom</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Votre nom"
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditNameVisible(false)}
                disabled={savingName}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSpacer: {
    paddingTop: 48,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  identifier: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    marginLeft: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellPlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cellText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: colors.surfaceLight,
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  modalSaveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});
