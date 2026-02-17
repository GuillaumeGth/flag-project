/**
 * ConversationScreen - Redesigned with Neo-Cartographic theme
 *
 * Improvements:
 * - Glass header with gradient background
 * - Premium message bubbles with subtle glass effect
 * - Gradient send button
 * - Better photo/audio UI
 * - Smooth message animations
 * - Premium input area
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchConversationMessages,
  getCachedConversationMessages,
  sendMessage,
  FLAG_BOT_ID,
  uploadMedia,
} from '@/services/messages';
import { isEitherFollowing } from '@/services/subscriptions';
import { MessageWithUsers, MessageContentType } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import { reportError } from '@/services/errorReporting';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumButton from '@/components/redesign/PremiumButton';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';

interface Props {
  navigation: any;
  route: any;
}

export default function ConversationScreenRedesign({ navigation, route }: Props) {
  const { otherUserId, otherUserName, otherUserAvatarUrl } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [fullImageMessage, setFullImageMessage] = useState<MessageWithUsers | null>(null);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState<boolean>(true);

  // Local media state
  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingInputAudio, setIsPlayingInputAudio] = useState(false);
  const inputSoundRef = useRef<Audio.Sound | null>(null);

  const isBot = useMemo(() => otherUserId === FLAG_BOT_ID, [otherUserId]);

  // Animation values
  const [messageAnimations] = useState<Map<string, Animated.Value>>(new Map());

  useEffect(() => {
    loadMessages();
    checkCanSend();

    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
      if (inputSoundRef.current) {
        inputSoundRef.current.unloadAsync();
      }
    };
  }, []);

  // Reload messages when coming back from ReadMessageScreen so discovered messages are shown
  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );

  // Scroll to bottom when messages load (only once, when loading completes)
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      // Use requestAnimationFrame for smoother rendering
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [loading]); // Only depend on loading, not messages.length

  const checkCanSend = async () => {
    if (isBot) {
      setCanSendMessages(true);
      return;
    }
    const eitherFollowing = await isEitherFollowing(otherUserId);
    setCanSendMessages(eitherFollowing);
  };

  const loadMessages = async () => {
    // Load cached messages first, but don't hide loading yet
    if (messages.length === 0) {
      const cached = await getCachedConversationMessages(otherUserId);
      if (cached && cached.length > 0) {
        console.log('[ConversationScreen] showing', cached.length, 'cached messages');
        setMessages(cached);
        // Keep loading=true to avoid flicker
      }
    }

    // Fetch fresh messages
    const data = await fetchConversationMessages(otherUserId);
    setMessages(data);
    setLoading(false);
  };

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const hasText = !!inputText.trim();
    const hasMedia = !!mediaUri;
    if ((!hasText && !hasMedia) || sending) return;

    setSending(true);

    try {
      let finalContentType: MessageContentType = hasMedia ? contentType : 'text';
      let uploadedMediaUrl: string | undefined;

      if (hasMedia && mediaUri && contentType !== 'text') {
        const url = await uploadMedia(mediaUri, contentType as 'photo' | 'audio');
        if (!url) {
          console.error('ConversationScreen: media upload failed');
          reportError(new Error("Échec de l'upload du média"), 'ConversationScreen.handleSend.uploadMedia');
          setSending(false);
          return;
        }
        uploadedMediaUrl = url;
      } else if (!hasMedia) {
        finalContentType = 'text';
      }

      const message = await sendMessage(
        otherUserId,
        finalContentType,
        null,
        hasText ? inputText.trim() : undefined,
        uploadedMediaUrl
      );

      if (message) {
        setInputText('');
        setMediaUri(null);
        setContentType('text');
        if (inputSoundRef.current) {
          await inputSoundRef.current.unloadAsync();
          inputSoundRef.current = null;
        }
        setIsPlayingInputAudio(false);
        await loadMessages();
      } else {
        console.error('ConversationScreen: message could not be sent');
        reportError(new Error("Le message n'a pas pu être envoyé"), 'ConversationScreen.handleSend');
      }
    } catch (error) {
      console.error('Error sending conversation message:', error);
      reportError(error, 'ConversationScreen.handleSend.catch');
    }

    setSending(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      console.error('ConversationScreen: camera permission denied');
      reportError(new Error('Camera permission denied'), 'ConversationScreen.takePhoto.permission');
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
        console.error('ConversationScreen: microphone permission denied');
        reportError(new Error('Microphone permission denied'), 'ConversationScreen.startRecording.permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      reportError(error, 'ConversationScreen.startRecording.catch');
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

      const { sound } = await Audio.Sound.createAsync({ uri });
      inputSoundRef.current = sound;
    }
  };

  const playInputAudio = async () => {
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

  const handleAudioPress = async (message: MessageWithUsers) => {
    if (!message.media_url) return;

    if (playingMessageId === message.id && isPlayingAudio) {
      if (audioSound) {
        await audioSound.pauseAsync();
        setIsPlayingAudio(false);
      }
      return;
    }

    if (audioSound) {
      await audioSound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync({ uri: message.media_url });
    setAudioSound(sound);
    setPlayingMessageId(message.id);
    setIsPlayingAudio(true);

    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlayingAudio(false);
        setPlayingMessageId(null);
      }
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      });
    }
  };

  const getAnimationValue = (messageId: string): Animated.Value => {
    if (!messageAnimations.has(messageId)) {
      // Start at 1 (fully visible) to avoid animation on initial load
      messageAnimations.set(messageId, new Animated.Value(1));
    }
    return messageAnimations.get(messageId)!;
  };

  const renderMessage = ({ item, index }: { item: MessageWithUsers; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const prevMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
    const showDateSeparator = prevMessage
      ? new Date(item.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()
      : index === reversedMessages.length - 1;

    const isUndiscovered = !isFromMe && !item.is_read && item.location;

    const animValue = getAnimationValue(item.id);

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          {
            opacity: animValue,
            transform: [
              {
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.created_at)}
            </Text>
          </View>
        )}

        <View style={[styles.messageRow, isFromMe && styles.messageRowRight]}>
          {isUndiscovered ? (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('Main', {
                  screen: 'Map',
                  params: { messageId: item.id },
                });
              }}
              activeOpacity={0.9}
            >
              <GlassCard style={styles.undiscoveredBubble}>
                <View style={styles.blurredContent}>
                  <Ionicons name="lock-closed" size={20} color={colors.primary.magenta} />
                  <Text style={styles.undiscoveredText}>Message géolocalisé</Text>
                </View>
                <Text style={styles.messageTime}>
                  {formatTime(item.created_at)}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.messageBubble,
                isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
              ]}
            >
              {/* Photo */}
              {item.content_type === 'photo' && item.media_url && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullImageMessage(item)}
                >
                  <Image source={{ uri: item.media_url }} style={styles.messageImage} />
                </TouchableOpacity>
              )}

              {/* Audio */}
              {item.content_type === 'audio' && item.media_url && (
                <TouchableOpacity
                  style={styles.audioMessage}
                  activeOpacity={0.7}
                  onPress={() => handleAudioPress(item)}
                >
                  <View style={styles.audioIconContainer}>
                    <Ionicons
                      name={
                        playingMessageId === item.id && isPlayingAudio
                          ? 'pause'
                          : 'play'
                      }
                      size={18}
                      color={isFromMe ? colors.text.primary : colors.primary.cyan}
                    />
                  </View>
                  <Text style={[styles.audioText, isFromMe && styles.audioTextRight]}>
                    {playingMessageId === item.id && isPlayingAudio
                      ? 'En lecture...'
                      : 'Message audio'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Text */}
              {item.text_content && (
                <Text style={[styles.messageText, isFromMe && styles.messageTextRight]}>
                  {item.text_content}
                </Text>
              )}

              {/* Footer with flag and time */}
              <View style={styles.messageFooter}>
                {item.location && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      navigation.navigate('Main', {
                        screen: 'Map',
                        params: {
                          focusLocation: item.location,
                        },
                      });
                    }}
                    style={styles.flagButton}
                  >
                    <Ionicons
                      name="flag"
                      size={12}
                      color={isFromMe ? colors.text.secondary : colors.primary.cyan}
                    />
                  </TouchableOpacity>
                )}
                <Text style={[styles.messageTime, isFromMe && styles.messageTimeRight]}>
                  {formatTime(item.created_at)}
                  {isFromMe ? (item.is_read ? ' ✓✓' : ' ✓') : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {isUndiscovered && (
          <Text style={styles.undiscoveredHint}>Tap to view on map</Text>
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(124, 92, 252, 0.08)', 'transparent']}
          style={styles.headerGradient}
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerProfile}>
            <PremiumAvatar
              uri={otherUserAvatarUrl}
              name={otherUserName}
              size="small"
              isBot={isBot}
            />
            <Text style={styles.headerTitle}>{otherUserName}</Text>
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.cyan} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Gradient Background */}
      <View style={styles.headerGradient} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => !isBot && navigation.navigate('UserProfile', { userId: otherUserId })}
          disabled={isBot}
          activeOpacity={isBot ? 1 : 0.7}
        >
          <PremiumAvatar
            uri={otherUserAvatarUrl}
            name={otherUserName}
            size="small"
            isBot={isBot}
            withGlow={isBot}
            glowColor="cyan"
          />
          <Text style={styles.headerTitle}>{otherUserName}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.messagesContent}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        removeClippedSubviews={false}
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: spacing.lg + insets.bottom }]}>
        {/* Media Preview */}
        {mediaUri && (
          <View style={styles.mediaPreview}>
            {contentType === 'photo' ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: mediaUri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={() => {
                    setMediaUri(null);
                    setContentType('text');
                  }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            ) : contentType === 'audio' ? (
              <GlassCard style={styles.audioPreview}>
                <TouchableOpacity
                  style={styles.audioPlayButton}
                  onPress={playInputAudio}
                >
                  <Ionicons
                    name={isPlayingInputAudio ? 'pause' : 'play'}
                    size={20}
                    color={colors.primary.cyan}
                  />
                </TouchableOpacity>
                <Text style={styles.audioPreviewText}>Audio enregistré</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMediaUri(null);
                    setContentType('text');
                    if (inputSoundRef.current) {
                      inputSoundRef.current.unloadAsync();
                      inputSoundRef.current = null;
                    }
                  }}
                >
                  <Ionicons name="close" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </GlassCard>
            ) : null}
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          {!canSendMessages ? (
            <Text style={styles.cannotSendText}>
              Suivez-vous mutuellement pour échanger des messages
            </Text>
          ) : (
            <>
              {/* Attachment Buttons */}
              <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
                <Ionicons name="image-outline" size={24} color={colors.primary.cyan} />
              </TouchableOpacity>

              <TouchableOpacity onPress={takePhoto} style={styles.iconButton}>
                <Ionicons name="camera-outline" size={24} color={colors.primary.cyan} />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                style={styles.textInput}
                placeholder="Message..."
                placeholderTextColor={colors.text.tertiary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />

              {/* Audio Record Button OU Send Button (jamais les deux) */}
              {!inputText.trim() && !mediaUri && !sending ? (
                <TouchableOpacity
                  onPress={isRecording ? stopRecording : startRecording}
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
                    colors={colors.gradients.primary}
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

      {/* Full Image Modal */}
      <Modal
        visible={!!fullImageMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageMessage(null)}
      >
        <View style={styles.fullImageModal}>
          {fullImageMessage?.media_url && (
            <Image
              source={{ uri: fullImageMessage.media_url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={[styles.closeFullImage, { top: 60 + insets.top }]}
            onPress={() => setFullImageMessage(null)}
          >
            <View style={styles.closeButtonInner}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(124, 92, 252, 0.04)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface.glass,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageContainer: {
    marginBottom: spacing.sm,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateSeparatorText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    backgroundColor: colors.surface.glass,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  messageBubbleLeft: {
    backgroundColor: colors.surface.glassDark,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.2)',
  },
  messageBubbleRight: {
    backgroundColor: colors.message.sent,
    borderBottomRightRadius: radius.xs,
    ...shadows.medium,
  },
  undiscoveredBubble: {
    padding: spacing.md,
    maxWidth: '75%',
    backgroundColor: colors.message.undiscovered,
  },
  blurredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  undiscoveredText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  undiscoveredHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  audioIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  audioTextRight: {
    color: colors.text.primary,
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    lineHeight: 20,
  },
  messageTextRight: {
    color: colors.text.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flagButton: {
    padding: 2,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  messageTimeRight: {
    color: colors.text.secondary,
  },
  inputContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
    fontSize: typography.sizes.sm,
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
    fontSize: typography.sizes.sm,
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
    fontSize: typography.sizes.md,
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
  fullImageModal: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeFullImage: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  closeButtonInner: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
});
