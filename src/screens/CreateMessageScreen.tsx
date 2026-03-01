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
import { Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useLocation } from '@/contexts/LocationContext';
import { sendMessage, uploadMedia } from '@/services/messages';
import { MessageContentType, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateMessage'>;

type Recipient = { id: string; name: string };

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

  const [isPublic, setIsPublic] = useState(false);
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
    } catch {
      // recording errors are non-critical
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
    } catch {
      // audio errors are non-critical
    }
  };

  const handleSend = async () => {
    if (!userLocation) {
      showToast('Position GPS non disponible', 'error');
      return;
    }

    if (!isPublic && recipients.length === 0) {
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

      if (isPublic) {
        // Send a single public message without recipient
        const result = await sendMessage(
          null,
          contentType,
          userLocation,
          textContent || undefined,
          uploadedMediaUrl,
          true
        );

        if (result) {
          navigation.navigate('Main', {
            screen: 'Map',
            params: { toast: { message: 'Message public envoyé !', type: 'success' } },
          });
          return;
        } else {
          showToast('Échec de l\'envoi', 'error', {
            label: 'Réessayer',
            onPress: handleSend,
          });
        }
      } else {
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
        // results logged implicitly via successCount check below
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
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
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
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau message</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.recipientRow, isPublic && { opacity: 0.4 }]}>
        <Text style={styles.recipientLabel}>À :</Text>
        <TouchableOpacity
          style={styles.recipientButton}
          onPress={() => navigation.navigate('SelectRecipient')}
          disabled={isPublic}
        >
          <Text style={styles.recipientName} numberOfLines={2}>
            {recipientsDisplay}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.publicToggleRow}>
        <Ionicons name="globe-outline" size={18} color={isPublic ? colors.primary.cyan : colors.text.secondary} />
        <Text style={[styles.publicToggleLabel, isPublic && { color: colors.primary.cyan }]}>Public</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: colors.border.default, true: colors.primary.cyan }}
          thumbColor={colors.text.primary}
        />
      </View>

      {/* Media preview */}
      {mediaUri && contentType === 'photo' && (
        <View style={styles.mediaPreview}>
          <Image source={{ uri: mediaUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.clearMedia} onPress={clearMedia}>
            <Ionicons name="close-circle" size={28} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      {mediaUri && contentType === 'audio' && (
        <View style={styles.audioPreview}>
          <TouchableOpacity onPress={playAudio} style={styles.playButton}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={styles.audioText}>
            {isPlaying ? 'Lecture en cours...' : 'Audio enregistré'}
          </Text>
          <TouchableOpacity onPress={clearMedia}>
            <Ionicons name="close-circle" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Text input */}
      <TextInput
        style={styles.textInput}
        placeholder="Votre message..."
        placeholderTextColor={colors.text.tertiary}
        multiline
        value={textContent}
        onChangeText={setTextContent}
      />

      {/* Media buttons */}
      <View style={styles.mediaButtons}>
        <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color={colors.primary.cyan} />
          <Text style={styles.mediaButtonText}>Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color={colors.primary.cyan} />
          <Text style={styles.mediaButtonText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mediaButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={24}
            color={isRecording ? colors.error : colors.primary.cyan}
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
        style={[styles.sendButtonContainer, loading && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors.gradients.button}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sendButton}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Envoyer</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
    marginTop: 48,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recipientLabel: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  recipientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  recipientName: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  publicToggleLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  locationText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.primary.cyan,
  },
  mediaPreview: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
  },
  clearMedia: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    backgroundColor: colors.surface.glass,
    color: colors.text.primary,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xxl,
  },
  mediaButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  mediaButtonText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  recordingButton: {
    backgroundColor: colors.surface.glassDark,
    borderRadius: radius.md,
  },
  recordingText: {
    color: colors.error,
  },
  sendButtonContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.medium,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
