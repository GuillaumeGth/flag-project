import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage, FLAG_BOT_ID, uploadMedia } from '@/services/messages';
import { isEitherFollowing } from '@/services/subscriptions';
import { MessageWithUsers, MessageContentType, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing } from '@/theme-redesign';
import { reportError } from '@/services/errorReporting';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import MessageBubble from '@/components/conversation/MessageBubble';
import MessageInput from '@/components/conversation/MessageInput';
import ScreenLoader from '@/components/ScreenLoader';
import { useMessageLoader } from '@/hooks/useMessageLoader';
import { log } from '@/utils/debug';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export default function ConversationScreen({ navigation, route }: Props) {
  const { otherUserId, otherUserName, otherUserAvatarUrl } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const { messages, loading, loadMessages } = useMessageLoader(otherUserId);

  const [sending, setSending] = useState(false);
  const [fullImageMessage, setFullImageMessage] = useState<MessageWithUsers | null>(null);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState<boolean>(true);

  const isBot = useMemo(() => otherUserId === FLAG_BOT_ID, [otherUserId]);
  const [messageAnimations] = useState<Map<string, Animated.Value>>(new Map());

  useEffect(() => {
    loadMessages();
    checkCanSend();
    return () => {
      if (audioSound) audioSound.unloadAsync();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [loading]);

  const checkCanSend = async () => {
    if (isBot) { setCanSendMessages(true); return; }
    const eitherFollowing = await isEitherFollowing(otherUserId);
    setCanSendMessages(eitherFollowing);
  };

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async ({ text, mediaUri, contentType }: { text: string; mediaUri: string | null; contentType: MessageContentType }) => {
    const hasText = !!text.trim();
    const hasMedia = !!mediaUri;
    if ((!hasText && !hasMedia) || sending) return;

    setSending(true);
    try {
      let finalContentType: MessageContentType = hasMedia ? contentType : 'text';
      let uploadedMediaUrl: string | undefined;

      if (hasMedia && mediaUri && contentType !== 'text') {
        const url = await uploadMedia(mediaUri, contentType as 'photo' | 'audio');
        if (!url) {
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
        hasText ? text.trim() : undefined,
        uploadedMediaUrl
      );

      if (message) {
        await loadMessages();
      } else {
        reportError(new Error("Le message n'a pas pu être envoyé"), 'ConversationScreen.handleSend');
      }
    } catch (error) {
      reportError(error, 'ConversationScreen.handleSend.catch');
    }
    setSending(false);
  };

  const pickImage = async () => {
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      reportError(new Error('Camera permission denied'), 'ConversationScreen.takePhoto');
      return;
    }
    await ImagePicker.launchCameraAsync({ quality: 0.8 });
  };

  const handleAudioPress = async (message: MessageWithUsers) => {
    if (!message.media_url) return;
    if (playingMessageId === message.id && isPlayingAudio) {
      if (audioSound) { await audioSound.pauseAsync(); setIsPlayingAudio(false); }
      return;
    }
    if (audioSound) await audioSound.unloadAsync();
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

  const getAnimationValue = (messageId: string): Animated.Value => {
    if (!messageAnimations.has(messageId)) {
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

    return (
      <MessageBubble
        message={item}
        isFromMe={isFromMe}
        animValue={getAnimationValue(item.id)}
        showDateSeparator={showDateSeparator}
        isPlaying={isPlayingAudio}
        playingMessageId={playingMessageId}
        onPlayAudio={handleAudioPress}
        onViewImage={setFullImageMessage}
        onNavigateToMap={(location) => {
          navigation.navigate('Main', {
            screen: 'Map',
            params: { messageId: item.is_read ? undefined : item.id, focusLocation: location },
          });
        }}
      />
    );
  };

  const header = (
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
        <PremiumAvatar uri={otherUserAvatarUrl} name={otherUserName} size="small" isBot={isBot} withGlow={isBot} glowColor="cyan" />
        <Text style={styles.headerTitle}>{otherUserName}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerGradient} />
        {header}
        <ScreenLoader />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerGradient} />
      {header}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesContent}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          removeClippedSubviews={false}
        />

        <MessageInput
          sending={sending}
          canSendMessages={canSendMessages}
          paddingBottom={insets.bottom}
          onSend={handleSend}
          onPickImage={pickImage}
          onTakePhoto={takePhoto}
        />
      </KeyboardAvoidingView>

      <Modal visible={!!fullImageMessage} transparent animationType="fade" onRequestClose={() => setFullImageMessage(null)}>
        <View style={styles.fullImageModal}>
          {fullImageMessage?.media_url && (
            <Image source={{ uri: fullImageMessage.media_url }} style={styles.fullImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={[styles.closeFullImage, { top: 60 + insets.top }]} onPress={() => setFullImageMessage(null)}>
            <View style={styles.closeButtonInner}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.sm,
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
