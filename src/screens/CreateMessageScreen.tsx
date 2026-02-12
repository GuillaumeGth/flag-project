import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Toast from '@/components/Toast';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useLocation } from '@/contexts/LocationContext';
import { sendMessage, uploadMedia } from '@/services/messages';
import { MessageContentType } from '@/types';
import { colors } from '@/theme';

interface Recipient {
  id: string;
  name: string;
}

interface Props {
  navigation: any;
  route: {
    params?: {
      recipientId?: string;
      recipientName?: string;
      recipients?: Recipient[];
    };
  };
}

export default function CreateMessageScreen({ navigation, route }: Props) {
  const { current: userLocation } = useLocation();

  // Support both old format (single recipient) and new format (multiple recipients)
  const recipients: Recipient[] = route.params?.recipients ||
    (route.params?.recipientId
      ? [{ id: route.params.recipientId, name: route.params.recipientName || 'Destinataire' }]
      : []);

  const recipientsDisplay = recipients.length > 0
    ? recipients.map(r => r.name).join(', ')
    : 'Sélectionner';

  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'error';
    action?: { label: string; onPress: () => void };
  }>({ visible: false, message: '', type: 'success' });
  const soundRef = useRef<Audio.Sound | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'error', action?: { label: string; onPress: () => void }) => {
    setToast({ visible: true, message, type, action });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

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
      showToast('Accès à la caméra nécessaire', 'error');
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
        showToast('Accès au micro nécessaire', 'error');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
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

  const clearMedia = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setMediaUri(null);
    setContentType('text');
  };

  const playAudio = async () => {
    if (!mediaUri) return;

    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri: mediaUri });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      await sound.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleSend = async () => {
    if (!userLocation) {
      showToast('Position GPS non disponible', 'error');
      return;
    }

    if (recipients.length === 0) {
      showToast('Sélectionnez au moins un destinataire', 'error', {
        label: 'Choisir',
        onPress: () => navigation.navigate('SelectRecipient'),
      });
      return;
    }

    if (contentType === 'text' && !textContent.trim()) {
      showToast('Écrivez un message', 'error');
      return;
    }

    if ((contentType === 'photo' || contentType === 'audio') && !mediaUri) {
      showToast('Ajoutez une photo ou un audio', 'error');
      return;
    }

    setLoading(true);

    try {
      let uploadedMediaUrl: string | undefined;

      if (mediaUri && contentType !== 'text') {
        const url = await uploadMedia(mediaUri, contentType as 'photo' | 'audio');
        if (!url) {
          showToast('Échec de l\'upload du média', 'error', {
            label: 'Réessayer',
            onPress: handleSend,
          });
          setLoading(false);
          return;
        }
        uploadedMediaUrl = url;
      }

      // Send message to all recipients
      const sendPromises = recipients.map((recipient) =>
        sendMessage(
          recipient.id,
          contentType,
          userLocation,
          textContent || undefined,
          uploadedMediaUrl
        )
      );

      const results = await Promise.all(sendPromises);
      console.log('handleSend results:', results.map((r, i) => ({ recipient: recipients[i]?.id, success: !!r })));
      const successCount = results.filter(Boolean).length;

      if (successCount === recipients.length) {
        const msg = recipients.length > 1
          ? `Message envoyé à ${recipients.length} destinataires !`
          : 'Message envoyé !';
        navigation.navigate('Main', {
          screen: 'Map',
          params: { toast: { message: msg, type: 'success' } },
        });
        return;
      } else if (successCount > 0) {
        navigation.navigate('Main', {
          screen: 'Map',
          params: { toast: { message: `Message envoyé à ${successCount}/${recipients.length} destinataires`, type: 'warning' } },
        });
        return;
      } else {
        showToast('Échec de l\'envoi', 'error', {
          label: 'Réessayer',
          onPress: handleSend,
        });
      }
    } catch (error) {
      showToast('Une erreur est survenue', 'error', {
        label: 'Réessayer',
        onPress: handleSend,
      });
    }

    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      action={toast.action}
      onHide={hideToast}
    />
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
          <Text style={styles.recipientName} numberOfLines={2}>
            {recipientsDisplay}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.locationInfo}>
        <Ionicons name="location" size={16} color={colors.primary} />
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
          <TouchableOpacity onPress={playAudio} style={styles.playButton}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.audioText}>
            {isPlaying ? 'Lecture en cours...' : 'Audio enregistré'}
          </Text>
          <TouchableOpacity onPress={clearMedia}>
            <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Text input */}
      <TextInput
        style={styles.textInput}
        placeholder="Votre message..."
        placeholderTextColor={colors.textMuted}
        multiline
        value={textContent}
        onChangeText={setTextContent}
      />

      {/* Media buttons */}
      <View style={styles.mediaButtons}>
        <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color={colors.primary} />
          <Text style={styles.mediaButtonText}>Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color={colors.primary} />
          <Text style={styles.mediaButtonText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mediaButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={24}
            color={isRecording ? '#e74c3c' : colors.primary}
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
          <Ionicons name="arrow-up" size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recipientLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 8,
  },
  recipientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
  },
  recipientName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.primary,
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
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: colors.surfaceLight,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  recordingButton: {
    backgroundColor: '#3a1a1a',
    borderRadius: 8,
  },
  recordingText: {
    color: colors.error,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    width: 56,
    height: 56,
    alignSelf: 'center',
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
