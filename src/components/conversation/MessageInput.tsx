import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { MessageContentType, MessageWithUsers } from '@/types';
import { colors, spacing, radius, shadows } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import { reportError } from '@/services/errorReporting';
import ReplyPreview from './ReplyPreview';

interface MessageInputProps {
  sending: boolean;
  canSendMessages: boolean;
  paddingBottom: number;
  replyTo?: MessageWithUsers | null;
  onCancelReply?: () => void;
  onSend: (params: {
    text: string;
    mediaUri: string | null;
    contentType: MessageContentType;
  }) => Promise<void>;
  onPickImage: () => Promise<void>;
  onTakePhoto: () => Promise<void>;
}

export default function MessageInput({
  sending,
  canSendMessages,
  paddingBottom,
  replyTo,
  onCancelReply,
  onSend,
  onPickImage,
  onTakePhoto,
}: MessageInputProps) {
  const [inputText, setInputText] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingInputAudio, setIsPlayingInputAudio] = useState(false);
  const inputSoundRef = useRef<Audio.Sound | null>(null);

  const handleStartRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        reportError(new Error('Microphone permission denied'), 'MessageInput.startRecording');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      reportError(error, 'MessageInput.startRecording');
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) {
      setMediaUri(uri);
      setContentType('audio');
      const { sound } = await Audio.Sound.createAsync({ uri });
      inputSoundRef.current = sound;
    }
  };

  const handlePlayInputAudio = async () => {
    if (!inputSoundRef.current || !mediaUri) return;
    if (isPlayingInputAudio) {
      await inputSoundRef.current.pauseAsync();
      setIsPlayingInputAudio(false);
    } else {
      await inputSoundRef.current.replayAsync();
      setIsPlayingInputAudio(true);
      inputSoundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingInputAudio(false);
        }
      });
    }
  };

  const handlePickImage = async () => {
    await onPickImage();
  };

  const handleClearMedia = async () => {
    if (inputSoundRef.current) {
      await inputSoundRef.current.unloadAsync();
      inputSoundRef.current = null;
    }
    setIsPlayingInputAudio(false);
    setMediaUri(null);
    setContentType('text');
  };

  const handleSend = async () => {
    await onSend({ text: inputText, mediaUri, contentType });
    // Clear local state on successful send (parent calls this after success)
    setInputText('');
    setMediaUri(null);
    setContentType('text');
    if (inputSoundRef.current) {
      await inputSoundRef.current.unloadAsync();
      inputSoundRef.current = null;
    }
    setIsPlayingInputAudio(false);
  };

  return (
    <View style={[styles.inputContainer, { paddingBottom: spacing.lg + paddingBottom }]}>
      {replyTo && onCancelReply && (
        <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />
      )}
      {mediaUri && (
        <View style={styles.mediaPreview}>
          {contentType === 'photo' ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: mediaUri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeMediaButton} onPress={handleClearMedia}>
                <Ionicons name="close-circle" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          ) : contentType === 'audio' ? (
            <GlassCard style={styles.audioPreview}>
              <TouchableOpacity style={styles.audioPlayButton} onPress={handlePlayInputAudio}>
                <Ionicons
                  name={isPlayingInputAudio ? 'pause' : 'play'}
                  size={20}
                  color={colors.primary.cyan}
                />
              </TouchableOpacity>
              <Text style={styles.audioPreviewText}>Audio enregistré</Text>
              <TouchableOpacity onPress={handleClearMedia}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </GlassCard>
          ) : null}
        </View>
      )}

      <View style={styles.inputRow}>
        {!canSendMessages ? (
          <Text style={styles.cannotSendText}>
            Suivez-vous mutuellement pour échanger des messages
          </Text>
        ) : (
          <>
            <TouchableOpacity onPress={handlePickImage} style={styles.iconButton}>
              <Ionicons name="image-outline" size={24} color={colors.primary.cyan} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onTakePhoto} style={styles.iconButton}>
              <Ionicons name="camera-outline" size={24} color={colors.primary.cyan} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Message..."
              placeholderTextColor={colors.text.tertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            {!inputText.trim() && !mediaUri && !sending ? (
              <TouchableOpacity
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                style={[styles.iconButton, isRecording && styles.recordingButton]}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic-outline'}
                  size={24}
                  color={isRecording ? colors.text.primary : colors.primary.cyan}
                />
              </TouchableOpacity>
            ) : !sending ? (
              <TouchableOpacity onPress={handleSend} activeOpacity={0.9}>
                <LinearGradient
                  colors={colors.gradients.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.sendButton, shadows.glow]}
                >
                  <Ionicons name="send" size={18} color={colors.text.primary} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <ActivityIndicator size="small" color={colors.primary.cyan} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  mediaPreview: {
    marginBottom: spacing.sm,
  },
  photoPreview: {
    position: 'relative',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioPreviewText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  cannotSendText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
  },
  recordingButton: {
    backgroundColor: colors.error,
    borderRadius: radius.full,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    maxHeight: 100,
    paddingVertical: spacing.xs,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
