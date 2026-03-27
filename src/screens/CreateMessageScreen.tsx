import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Coordinates, MessageContentType, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import GlassInput from '@/components/redesign/GlassInput';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateMessage'>;

export default function CreateMessageScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [adminLocation] = useState<Coordinates | null>(
    () => (user?.is_admin && route.params?.adminLocation ? route.params.adminLocation : null)
  );

  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [discardDialogVisible, setDiscardDialogVisible] = useState(false);
  // Stores the navigation action to dispatch if user confirms discard
  const pendingDiscardAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'error';
  }>({ visible: false, message: '', type: 'success' });
  const soundRef = useRef<Audio.Sound | null>(null);

  // Detect whether the user has started composing content
  const hasDraft = textContent.trim().length > 0 || mediaUri !== null;

  // Intercept back navigation when a draft exists — show custom dialog instead of native Alert
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasDraft) return;
      e.preventDefault();
      pendingDiscardAction.current = e.data.action;
      setDiscardDialogVisible(true);
    });
    return unsubscribe;
  }, [navigation, hasDraft]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardDialogVisible(false);
    if (pendingDiscardAction.current) {
      navigation.dispatch(pendingDiscardAction.current);
      pendingDiscardAction.current = null;
    }
  }, [navigation]);

  const handleDiscardCancel = useCallback(() => {
    setDiscardDialogVisible(false);
    pendingDiscardAction.current = null;
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'error') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

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
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
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
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: mediaUri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
      });
      await sound.playAsync();
      setIsPlaying(true);
    } catch {
      // audio errors are non-critical
    }
  };

  const handleNext = () => {
    if (contentType === 'text' && !textContent.trim()) {
      showToast('Écris un message ou ajoute un média', 'error');
      return;
    }
    if ((contentType === 'photo' || contentType === 'audio') && !mediaUri) {
      showToast('Ajoute une photo ou un audio', 'error');
      return;
    }
    navigation.navigate('SendMessage', {
      contentType,
      textContent: textContent || undefined,
      mediaUri: mediaUri ?? undefined,
      adminLocation: adminLocation ?? undefined,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ConfirmDialog
        visible={discardDialogVisible}
        title={t('createMessage.abandonTitle')}
        message="Le contenu que tu as créé sera perdu définitivement."
        confirmLabel="Abandonner"
        cancelLabel="Continuer"
        destructive
        onConfirm={handleDiscardConfirm}
        onCancel={handleDiscardCancel}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
      <ScrollViewWithScrollbar style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.header, { marginTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Ionicons name="location" size={18} color="#FFFFFF" />
            <Text style={styles.title}>{t('createMessage.title')}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Admin placement badge */}
        {adminLocation && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>{t('createMessage.adminBadge')}</Text>
            <Text style={styles.adminBadgeCoords}>
              {adminLocation.latitude.toFixed(5)}, {adminLocation.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Photo preview */}
        {mediaUri && contentType === 'photo' && (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: mediaUri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.clearMedia} onPress={clearMedia}>
              <Ionicons name="close-circle" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Audio preview */}
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
        <GlassInput
          style={styles.textInput}
          placeholder={t('createMessage.placeholder')}
          multiline
          value={textContent}
          onChangeText={setTextContent}
        />

        {/* Media buttons */}
        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="image" size={24} color={colors.primary.cyan} />
            <Text style={styles.mediaButtonText}>{t('createMessage.gallery')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color={colors.primary.cyan} />
            <Text style={styles.mediaButtonText}>{t('createMessage.photo')}</Text>
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
            <Text style={[styles.mediaButtonText, isRecording && styles.recordingText]}>
              {isRecording ? 'Stop' : 'Audio'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Next button */}
        <TouchableOpacity
          style={[styles.nextButtonContainer, !hasDraft && styles.nextButtonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>{t('createMessage.next')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollViewWithScrollbar>
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
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
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
  nextButtonContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.medium,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  nextButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadge: {
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: 2,
  },
  adminBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#FFD700',
  },
  adminBadgeCoords: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
});
