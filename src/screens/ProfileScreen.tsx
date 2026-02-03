import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { user, signOut, updateAvatar, updateDisplayName } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

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

  const handleSignOut = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: signOut },
      ]
    );
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
      </View>

      <View style={styles.profileSection}>
        <TouchableOpacity onPress={handleChangeAvatar} disabled={uploading}>
          <View style={styles.avatar}>
            {uploading ? (
              <ActivityIndicator size="large" color="#4A90D9" />
            ) : user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={48} color="#999" />
            )}
          </View>
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEditName} style={styles.nameContainer}>
          <Text style={styles.displayName}>
            {user?.display_name || 'Utilisateur'}
          </Text>
          <Ionicons name="pencil" size={16} color="#4A90D9" style={styles.editIcon} />
        </TouchableOpacity>
        <Text style={styles.identifier}>
          {user?.phone || user?.email || ''}
        </Text>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="person-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Modifier le profil</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="shield-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Confidentialité</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Aide</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Flag v1.0.0</Text>

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
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    backgroundColor: '#4A90D9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  identifier: {
    fontSize: 14,
    color: '#999',
  },
  menuSection: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#333',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  signOutText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#e74c3c',
  },
  version: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 12,
    marginTop: 'auto',
    paddingBottom: 32,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});
