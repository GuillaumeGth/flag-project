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
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage, FLAG_BOT_ID, uploadMedia, deleteMessage } from '@/services/messages';
import { isEitherFollowing } from '@/services/subscriptions';
import { fetchReactionsForMessages, toggleReaction } from '@/services/reactions';
import { MessageWithUsers, MessageContentType, RootStackParamList, ReactionSummary } from '@/types';
import { colors, shadows, radius, spacing } from '@/theme-redesign';
import { reportError } from '@/services/errorReporting';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import MessageBubble from '@/components/conversation/MessageBubble';
import MessageInput from '@/components/conversation/MessageInput';
import ReactionPicker from '@/components/conversation/ReactionPicker';
import ScreenLoader from '@/components/ScreenLoader';
import { useMessageLoader } from '@/hooks/useMessageLoader';
import { log } from '@/utils/debug';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

// Stable empty array to avoid creating new references when no reactions exist
const EMPTY_REACTIONS: ReactionSummary[] = [];

export default function ConversationScreen({ navigation, route }: Props) {
  const { otherUserId, otherUserName, otherUserAvatarUrl, scrollToMessageId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  // Stores measured heights per message id — used for reliable scroll-to
  const itemHeightsRef = useRef<Map<string, number>>(new Map());

  const { messages, loading, loadMessages } = useMessageLoader(otherUserId);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const [sending, setSending] = useState(false);
  const [fullImageMessage, setFullImageMessage] = useState<MessageWithUsers | null>(null);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState<boolean>(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<MessageWithUsers | null>(null);
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [pickerAnchorY, setPickerAnchorY] = useState<number | undefined>(undefined);

  // ── Reactions state ──────────────────────────────────────────────────────
  const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
  // Ref keeps the latest reactionsMap accessible in stable callbacks without
  // re-creating them on every state update (generationRef pattern).
  const reactionsMapRef = useRef<Record<string, ReactionSummary[]>>({});

  useEffect(() => {
    reactionsMapRef.current = reactionsMap;
  }, [reactionsMap]);

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
        if (scrollToMessageId) {
          setTimeout(() => handleScrollToMessage(scrollToMessageId), 200);
        } else {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        }
      });
    }
  }, [loading]);

  // Load reactions whenever the message list changes
  useEffect(() => {
    if (messages.length === 0 || !user) return;
    const ids = messages.map((m) => m.id);
    fetchReactionsForMessages(ids, user.id).then(setReactionsMap);
  }, [messages, user]);

  const checkCanSend = async () => {
    if (isBot) { setCanSendMessages(true); return; }
    const eitherFollowing = await isEitherFollowing(otherUserId);
    setCanSendMessages(eitherFollowing);
  };

  const handleReplySelected = useCallback(() => {
    if (!selectedMessageId) return;
    const msg = messages.find((m) => m.id === selectedMessageId);
    if (msg) setReplyToMessage(msg);
    setSelectedMessageId(null);
  }, [selectedMessageId, messages]);

  const handleDeleteSelected = async () => {
    if (!selectedMessageId || !user) return;
    const msg = messages.find((m) => m.id === selectedMessageId);
    if (!msg) return;
    const isSender = msg.sender_id === user.id;
    setSelectedMessageId(null);
    await deleteMessage(selectedMessageId, otherUserId, isSender);
    await loadMessages();
  };

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const index = reversedMessages.findIndex((m) => m.id === messageId);
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  }, [reversedMessages]);

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

      const replyId = replyToMessage?.id;
      const message = await sendMessage(
        otherUserId,
        finalContentType,
        null,
        hasText ? text.trim() : undefined,
        uploadedMediaUrl,
        false,
        replyToMessage?.id ?? null
      );
      setReplyToMessage(null);

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

  // Stable handler — reads latest state via ref, never recreated when reactionsMap changes
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;

      const currentReactions = reactionsMapRef.current[messageId] ?? [];
      const existing = currentReactions.find((r) => r.emoji === emoji);
      const hasReacted = existing?.has_reacted ?? false;

      // Optimistic update so the UI responds instantly
      setReactionsMap((prev) => {
        const current = [...(prev[messageId] ?? [])];
        const idx = current.findIndex((r) => r.emoji === emoji);

        if (hasReacted) {
          if (idx >= 0) {
            const newCount = current[idx].count - 1;
            if (newCount <= 0) {
              current.splice(idx, 1);
            } else {
              current[idx] = {
                ...current[idx],
                count: newCount,
                has_reacted: false,
                user_ids: current[idx].user_ids.filter((id) => id !== user.id),
              };
            }
          }
        } else {
          if (idx >= 0) {
            current[idx] = {
              ...current[idx],
              count: current[idx].count + 1,
              has_reacted: true,
              user_ids: [...current[idx].user_ids, user.id],
            };
          } else {
            current.push({ emoji, count: 1, has_reacted: true, user_ids: [user.id] });
          }
        }

        return { ...prev, [messageId]: current };
      });

      await toggleReaction(messageId, emoji, user.id, hasReacted);
    },
    [user]
  );

  const renderMessage = ({ item, index }: { item: MessageWithUsers; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const prevMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
    const showDateSeparator = prevMessage
      ? new Date(item.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()
      : index === reversedMessages.length - 1;

    return (
      <View onLayout={(e) => { itemHeightsRef.current.set(item.id, e.nativeEvent.layout.height); }}>
      <MessageBubble
        message={item}
        isFromMe={isFromMe}
        animValue={getAnimationValue(item.id)}
        showDateSeparator={showDateSeparator}
        isPlaying={isPlayingAudio}
        playingMessageId={playingMessageId}
        reactions={reactionsMap[item.id] ?? EMPTY_REACTIONS}
        reply={item.reply_to ?? undefined}
        onQuotedPress={item.reply_to ? () => handleScrollToMessage(item.reply_to!.id) : undefined}
        isSelected={selectedMessageId === item.id}
        onPress={() => {
            if (pickerMessageId) { setPickerMessageId(null); return; }
            if (selectedMessageId) setSelectedMessageId(null);
          }}
        onPlayAudio={handleAudioPress}
        onViewImage={setFullImageMessage}
        onLongPress={(pageY) => {
            const isDeleted = isFromMe ? item.deleted_by_sender : item.deleted_by_recipient;
            if (!isDeleted) {
              setPickerMessageId(item.id);
              setPickerAnchorY(pageY);
              setSelectedMessageId((prev) => prev === item.id ? null : item.id);
            }
          }}
        onReactionPress={(emoji) => handleReactionToggle(item.id, emoji)}
        onScrollToMessage={handleScrollToMessage}
        showSenderNameInReply={false}
        onNavigateToMap={(location) => {
          navigation.navigate('Main', {
            screen: 'Map',
            params: { messageId: item.is_read ? undefined : item.id, focusLocation: location },
          });
        }}
      />
      </View>
    );
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => selectedMessageId ? setSelectedMessageId(null) : navigation.goBack()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerProfile}
        onPress={() => !isBot && !selectedMessageId && navigation.navigate('UserProfile', { userId: otherUserId })}
        disabled={isBot || !!selectedMessageId}
        activeOpacity={isBot || !!selectedMessageId ? 1 : 0.7}
      >
        <PremiumAvatar uri={otherUserAvatarUrl} name={otherUserName} size="small" isBot={isBot} withGlow={isBot} glowColor="cyan" />
        <Text style={styles.headerTitle}>{otherUserName}</Text>
      </TouchableOpacity>
      {selectedMessageId && (
        <>
          <TouchableOpacity
            onPress={() => {
              const msg = messages.find((m) => m.id === selectedMessageId);
              if (msg) setReplyToMessage(msg);
              setSelectedMessageId(null);
            }}
            style={styles.deleteButton}
          >
            <Ionicons name="return-up-back-outline" size={22} color={colors.primary.cyan} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteSelected} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={22} color={colors.primary.magenta} />
          </TouchableOpacity>
        </>
      )}
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
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesContent}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          removeClippedSubviews={false}
          onScrollBeginDrag={() => setPickerMessageId(null)}
          onScrollToIndexFailed={(info) => {
            // Scroll to approximate position first (forces render), then retry exact index
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, 150);
          }}
        />

        <MessageInput
          sending={sending}
          canSendMessages={canSendMessages}
          paddingBottom={insets.bottom}
          replyTo={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
          onSend={handleSend}
          onPickImage={pickImage}
          onTakePhoto={takePhoto}
        />
      </KeyboardAvoidingView>

      <ReactionPicker
        visible={!!pickerMessageId}
        anchorY={pickerAnchorY}
        currentReactions={
          pickerMessageId
            ? (reactionsMap[pickerMessageId] ?? EMPTY_REACTIONS)
                .filter((r) => r.has_reacted)
                .map((r) => r.emoji)
            : []
        }
        onSelect={(emoji) => {
          if (pickerMessageId) handleReactionToggle(pickerMessageId, emoji);
        }}
        onClose={() => setPickerMessageId(null)}
      />

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
  deleteButton: {
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
