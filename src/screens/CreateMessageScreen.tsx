import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useLocation } from '@/contexts/LocationContext';
import { sendMessage, uploadMedia } from '@/services/messages';
import { MessageContentType } from '@/types';

interface Props {
  navigation: any;
  route: {
    params?: {
      recipientId?: string;
      recipientName?: string;
    };
  };
}

export default function CreateMessageScreen({ navigation, route }: Props) {
  const { current: userLocation } = useLocation();
  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName || 'Destinataire';

  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('photo');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Accès à la caméra nécessaire');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('photo');
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Accès au micro nécessaire');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      setMediaUri(uri);
      setContentType('audio');
    }
  };

  const clearMedia = () => {
    setMediaUri(null);
    setContentType('text');
  };

  const handleSend = async () => {
    if (!userLocation) {
      Alert.alert('Erreur', 'Position GPS non disponible');
      return;
    }

    if (!recipientId) {
      Alert.alert('Erreur', 'Sélectionnez un destinataire');
      return;
    }

    if (contentType === 'text' && !textContent.trim()) {
      Alert.alert('Erreur', 'Écrivez un message');
      return;
    }

    if ((contentType === 'photo' || contentType === 'audio') && !mediaUri) {
      Alert.alert('Erreur', 'Ajoutez une photo ou un audio');
      return;
    }

    setLoading(true);

    try {
      let uploadedMediaUrl: string | undefined;

      if (mediaUri && contentType !== 'text') {
        const url = await uploadMedia(mediaUri, contentType as 'photo' | 'audio');
        if (!url) {
          Alert.alert('Erreur', 'Échec de l\'upload du média');
          setLoading(false);
          return;
        }
        uploadedMediaUrl = url;
      }

      const message = await sendMessage(
        recipientId,
        contentType,
        userLocation,
        textContent || undefined,
        uploadedMediaUrl
      );

      if (message) {
        Alert.alert('Succès', 'Message envoyé !', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Erreur', 'Échec de l\'envoi');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    }

    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau message</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.recipientRow}>
        <Text style={styles.recipientLabel}>À :</Text>
        <TouchableOpacity
          style={styles.recipientButton}
          onPress={() => navigation.navigate('SelectRecipient')}
        >
          <Text style={styles.recipientName}>{recipientName}</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.locationInfo}>
        <Ionicons name="location" size={16} color="#4A90D9" />
        <Text style={styles.locationText}>
          Ce message sera ancré à votre position actuelle
        </Text>
      </View>

      {/* Media preview */}
      {mediaUri && contentType === 'photo' && (
        <View style={styles.mediaPreview}>
          <Image source={{ uri: mediaUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.clearMedia} onPress={clearMedia}>
            <Ionicons name="close-circle" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {mediaUri && contentType === 'audio' && (
        <View style={styles.audioPreview}>
          <Ionicons name="mic" size={24} color="#4A90D9" />
          <Text style={styles.audioText}>Audio enregistré</Text>
          <TouchableOpacity onPress={clearMedia}>
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* Text input */}
      <TextInput
        style={styles.textInput}
        placeholder="Votre message..."
        placeholderTextColor="#999"
        multiline
        value={textContent}
        onChangeText={setTextContent}
      />

      {/* Media buttons */}
      <View style={styles.mediaButtons}>
        <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#4A90D9" />
          <Text style={styles.mediaButtonText}>Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color="#4A90D9" />
          <Text style={styles.mediaButtonText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mediaButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={24}
            color={isRecording ? '#e74c3c' : '#4A90D9'}
          />
          <Text
            style={[
              styles.mediaButtonText,
              isRecording && styles.recordingText,
            ]}
          >
            {isRecording ? 'Stop' : 'Audio'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendButton, loading && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.sendButtonText}>Envoyer</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recipientLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  recipientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  recipientName: {
    fontSize: 16,
    color: '#333',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4A90D9',
  },
  mediaPreview: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  clearMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  audioText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 12,
  },
  mediaButtonText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  recordingButton: {
    backgroundColor: '#ffe5e5',
    borderRadius: 8,
  },
  recordingText: {
    color: '#e74c3c',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 16,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
