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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { MessageWithUsers, MessageContentType } from '@/types';
import { colors } from '@/theme';

interface Props {
  navigation: any;
  route: any;
}

export default function ConversationScreen({ navigation, route }: Props) {
  const { otherUserId, otherUserName, otherUserAvatarUrl } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Local media state for composing a message
  const [contentType, setContentType] = useState<MessageContentType>('text');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingInputAudio, setIsPlayingInputAudio] = useState(false);
  const inputSoundRef = useRef<Audio.Sound | null>(null);

  const isBot = otherUserId === FLAG_BOT_ID;

  useEffect(() => {
    loadMessages();

    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
      if (inputSoundRef.current) {
        inputSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadMessages = async () => {
    // Show cached messages instantly if available
    if (messages.length === 0) {
      const cached = await getCachedConversationMessages(otherUserId);
      if (cached && cached.length > 0) {
        console.log('[ConversationScreen] showing', cached.length, 'cached messages');
        setMessages(cached);
        setLoading(false);
      }
    }

    // Then fetch incremental updates from server
    const data = await fetchConversationMessages(otherUserId);
    setMessages(data);
    setLoading(false);
  };

  // Reverse messages for inverted FlatList (newest at bottom)
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
          Alert.alert('Erreur', "Échec de l'upload du média");
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
        null, // No geolocation for conversation messages
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
      }
    } catch (error) {
      console.error('Error sending conversation message:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de l'envoi");
    }

    setSending(false);
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
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording (conversation):', error);
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
    if (inputSoundRef.current) {
      await inputSoundRef.current.unloadAsync();
      inputSoundRef.current = null;
    }
    setIsPlayingInputAudio(false);
    setMediaUri(null);
    setContentType('text');
  };

  const playInputAudio = async () => {
    if (!mediaUri) return;

    try {
      if (isPlayingInputAudio && inputSoundRef.current) {
        await inputSoundRef.current.stopAsync();
        setIsPlayingInputAudio(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      if (inputSoundRef.current) {
        await inputSoundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri: mediaUri });
      inputSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingInputAudio(false);
        }
      });

      await sound.playAsync();
      setIsPlayingInputAudio(true);
    } catch (error) {
      console.error('Error playing input audio (conversation):', error);
    }
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
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Aujourd'hui";
    } else if (days === 1) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
  };

  const handleAudioPress = useCallback(
    async (message: MessageWithUsers) => {
      if (!message.media_url) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        // If tapping the currently playing message
        if (playingMessageId === message.id && audioSound) {
          const status = await audioSound.getStatusAsync();
          if ('isLoaded' in status && status.isLoaded && status.isPlaying) {
            await audioSound.pauseAsync();
            setIsPlayingAudio(false);
          } else {
            await audioSound.playAsync();
            setIsPlayingAudio(true);
          }
          return;
        }

        // New message or no sound yet: unload previous
        if (audioSound) {
          await audioSound.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync({ uri: message.media_url });
        setAudioSound(sound);
        setPlayingMessageId(message.id);
        setIsPlayingAudio(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingAudio(false);
            setPlayingMessageId(null);
          }
        });

        await sound.playAsync();
      } catch (error) {
        console.error('Error playing audio in conversation:', error);
      }
    },
    [audioSound, playingMessageId]
  );

  const shouldShowDateSeparator = (index: number) => {
    // With inverted list, compare with next item (which appears above visually)
    if (index === reversedMessages.length - 1) return true;
    const currentDate = new Date(reversedMessages[index].created_at).toDateString();
    const nextDate = new Date(reversedMessages[index + 1].created_at).toDateString();
    return currentDate !== nextDate;
  };

  const renderMessage = ({ item, index }: { item: MessageWithUsers; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const showDateSeparator = shouldShowDateSeparator(index);
    const isUndiscovered = !isFromMe && !item.is_read;

    const handleUndiscoveredPress = () => {
      if (isUndiscovered && item.location) {
        navigation.navigate('Main', {
          screen: 'Map',
          params: {
            messageId: item.id,
            canOpen: false,
          },
        });
      }
    };

    return (
      <View>
        <View
          style={[
            styles.messageContainer,
            isFromMe ? styles.messageContainerRight : styles.messageContainerLeft,
          ]}
        >
          {isUndiscovered ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleUndiscoveredPress}>
              <View
                style={[
                  styles.messageBubble,
                  isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
                  styles.messageBubbleUndiscovered,
                ]}
              >
                {item.content_type === 'photo' && item.media_url && (
                  <Image source={{ uri: item.media_url }} style={styles.messageImage} blurRadius={20} />
                )}
                {item.content_type === 'audio' && (
                  <View style={styles.audioMessage}>
                    <Ionicons name="mic" size={20} color={isFromMe ? '#fff' : '#4A90D9'} />
                    <Text style={[styles.audioText, isFromMe && styles.audioTextRight]}>
                      Message audio
                    </Text>
                  </View>
                )}
                {item.text_content ? (
                  <Text style={[styles.messageText, isFromMe && styles.messageTextRight, styles.messageTextBlurred]}>
                    {'••••••••••••••••'}
                  </Text>
                ) : null}
                <Text style={[styles.messageTime, isFromMe && styles.messageTimeRight]}>
                  {formatTime(item.created_at)}
                  {isFromMe ? (item.is_read ? ' ✓✓' : ' ✓') : ''}
                </Text>
                <View style={styles.blurOverlay} />
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.messageBubble,
                isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
              ]}
            >
              {item.content_type === 'photo' && item.media_url && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullImageUrl(item.media_url || null)}
                >
                  <Image source={{ uri: item.media_url }} style={styles.messageImage} />
                </TouchableOpacity>
              )}
              {item.content_type === 'audio' && item.media_url && (
                <TouchableOpacity
                  style={styles.audioMessage}
                  activeOpacity={0.7}
                  onPress={() => handleAudioPress(item)}
                >
                  <Ionicons
                    name={
                      playingMessageId === item.id && isPlayingAudio
                        ? 'pause'
                        : 'play'
                    }
                    size={20}
                    color={isFromMe ? '#fff' : '#4A90D9'}
                  />
                  <Text style={[styles.audioText, isFromMe && styles.audioTextRight]}>
                    {playingMessageId === item.id && isPlayingAudio
                      ? 'En lecture...'
                      : 'Message audio'}
                  </Text>
                </TouchableOpacity>
              )}
              {item.text_content ? (
                <Text style={[styles.messageText, isFromMe && styles.messageTextRight]}>
                  {item.text_content}
                </Text>
              ) : null}
              <View style={[styles.messageFooter, !item.location && styles.messageFooterNoFlag]}>
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
                    <Ionicons name="flag" size={12} color={isFromMe ? 'rgba(255, 255, 255, 0.7)' : '#4A90D9'} />
                  </TouchableOpacity>
                )}
                <Text style={[styles.messageTime, isFromMe && styles.messageTimeRight]}>
                  {formatTime(item.created_at)}
                  {isFromMe ? (item.is_read ? ' ✓✓' : ' ✓') : ''}
                </Text>
              </View>
            </View>
          )}
          {isUndiscovered && (
            <Text style={styles.undiscoveredHint}>Approchez-vous pour découvrir</Text>
          )}
        </View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.created_at)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, isBot && styles.headerAvatarBot]}>
            {otherUserAvatarUrl ? (
              <Image source={{ uri: otherUserAvatarUrl }} style={styles.headerAvatarImage} />
            ) : (
              <Ionicons name={isBot ? 'flag' : 'person'} size={20} color={isBot ? '#4A90D9' : '#999'} />
            )}
          </View>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, isBot && styles.headerAvatarBot]}>
          {otherUserAvatarUrl ? (
            <Image source={{ uri: otherUserAvatarUrl }} style={styles.headerAvatarImage} />
          ) : (
            <Ionicons name={isBot ? 'flag' : 'person'} size={20} color={isBot ? '#4A90D9' : '#999'} />
          )}
        </View>
        <Text style={styles.headerTitle}>{otherUserName}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        inverted
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun message</Text>
            <Text style={styles.emptySubtext}>Envoyez le premier message !</Text>
          </View>
        }
      />

      {fullImageUrl && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setFullImageUrl(null)}
        >
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={() => setFullImageUrl(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.fullscreenImageContainer}>
              <Image
                source={{ uri: fullImageUrl }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 6 }]}>
        {mediaUri && contentType === 'photo' && (
          <View style={styles.inputMediaPreview}>
            <Image source={{ uri: mediaUri }} style={styles.inputMediaImage} />
            <TouchableOpacity onPress={clearMedia} style={styles.inputMediaClear}>
              <Ionicons name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {mediaUri && contentType === 'audio' && (
          <View style={styles.inputAudioPreview}>
            <TouchableOpacity onPress={playInputAudio} style={styles.inputAudioPlayButton}>
              <Ionicons
                name={isPlayingInputAudio ? 'pause' : 'play'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={styles.inputAudioText}>
              {isPlayingInputAudio ? 'Lecture en cours...' : 'Audio enregistré'}
            </Text>
            <TouchableOpacity onPress={clearMedia}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Votre message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity onPress={pickImage} style={styles.inputIconButton}>
                <Ionicons name="image" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto} style={styles.inputIconButton}>
                <Ionicons name="camera" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={async () => {
              const hasText = !!inputText.trim();

              if (hasText || mediaUri) {
                await handleSend();
                return;
              }

              if (isRecording) {
                await stopRecording();
              } else {
                await startRecording();
              }
            }}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={inputText.trim() || mediaUri ? 'send' : isRecording ? 'stop' : 'mic'}
                size={20}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarBot: {
    backgroundColor: colors.surfaceLight,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  messageContainerLeft: {
    alignSelf: 'flex-start',
  },
  messageContainerRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  messageBubbleLeft: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: colors.sent,
    borderBottomRightRadius: 4,
  },
  messageBubbleUndiscovered: {
    overflow: 'hidden',
    position: 'relative',
  },
  messageText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  messageTextRight: {
    color: '#fff',
  },
  messageTextBlurred: {
    color: colors.textMuted,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 30, 45, 0.85)',
  },
  undiscoveredHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.primary,
  },
  audioTextRight: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  messageFooterNoFlag: {
    justifyContent: 'flex-end',
  },
  flagButton: {
    padding: 2,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  messageTimeRight: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginRight: 8,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIconButton: {
    paddingHorizontal: 5,
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputMediaPreview: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputMediaImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },
  inputMediaClear: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  inputAudioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  inputAudioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputAudioText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  recordingButton: {
    backgroundColor: '#3a1a1a',
    borderRadius: 16,
  },
});
