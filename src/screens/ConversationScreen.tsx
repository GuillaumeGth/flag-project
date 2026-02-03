import React, { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchConversationMessages,
  sendMessage,
  markMessageAsRead,
  FLAG_BOT_ID,
} from '@/services/messages';
import { MessageWithUsers } from '@/types';

interface Props {
  navigation: any;
  route: any;
}

export default function ConversationScreen({ navigation, route }: Props) {
  const { otherUserId, otherUserName } = route.params;
  const insets = useSafeAreaInsets();
  const { current: userLocation } = useLocation();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');

  const isBot = otherUserId === FLAG_BOT_ID;

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    const data = await fetchConversationMessages(otherUserId);
    setMessages(data);
    setLoading(false);

    // Mark unread messages as read (except from Flag Bot for testing)
    for (const msg of data) {
      if (msg.recipient_id === user?.id && !msg.is_read && msg.sender_id !== FLAG_BOT_ID) {
        await markMessageAsRead(msg.id);
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !userLocation || sending) return;

    setSending(true);
    const message = await sendMessage(
      otherUserId,
      'text',
      userLocation,
      inputText.trim()
    );

    if (message) {
      setInputText('');
      await loadMessages();
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    setSending(false);
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

  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at).toDateString();
    const prevDate = new Date(messages[index - 1].created_at).toDateString();
    return currentDate !== prevDate;
  };

  const renderMessage = ({ item, index }: { item: MessageWithUsers; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const showDateSeparator = shouldShowDateSeparator(index);
    const isUndiscovered = !isFromMe && !item.is_read;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.created_at)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isFromMe ? styles.messageContainerRight : styles.messageContainerLeft,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isFromMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
              isUndiscovered && styles.messageBubbleUndiscovered,
            ]}
          >
            {item.content_type === 'photo' && item.media_url && (
              <Image source={{ uri: item.media_url }} style={styles.messageImage} blurRadius={isUndiscovered ? 20 : 0} />
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
              <Text style={[styles.messageText, isFromMe && styles.messageTextRight, isUndiscovered && styles.messageTextBlurred]}>
                {isUndiscovered ? '••••••••••••••••' : item.text_content}
              </Text>
            ) : null}
            <Text style={[styles.messageTime, isFromMe && styles.messageTimeRight]}>
              {formatTime(item.created_at)}
              {isFromMe ? (item.is_read ? ' ✓✓' : ' ✓') : ''}
            </Text>
            {isUndiscovered && (
              <View style={styles.blurOverlay} />
            )}
          </View>
          {isUndiscovered && (
            <Text style={styles.undiscoveredHint}>Approchez-vous pour découvrir</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, isBot && styles.headerAvatarBot]}>
            <Ionicons name={isBot ? 'flag' : 'person'} size={20} color={isBot ? '#4A90D9' : '#999'} />
          </View>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
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
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, isBot && styles.headerAvatarBot]}>
          <Ionicons name={isBot ? 'flag' : 'person'} size={20} color={isBot ? '#4A90D9' : '#999'} />
        </View>
        <Text style={styles.headerTitle}>{otherUserName}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun message</Text>
            <Text style={styles.emptySubtext}>Envoyez le premier message !</Text>
          </View>
        }
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
        <TextInput
          style={styles.input}
          placeholder="Votre message..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarBot: {
    backgroundColor: '#e8f4fd',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
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
    color: '#999',
    backgroundColor: '#e8e8e8',
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
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: '#4A90D9',
    borderBottomRightRadius: 4,
  },
  messageBubbleUndiscovered: {
    overflow: 'hidden',
    position: 'relative',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  messageTextRight: {
    color: '#fff',
  },
  messageTextBlurred: {
    color: '#ccc',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  undiscoveredHint: {
    fontSize: 11,
    color: '#999',
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
    color: '#4A90D9',
  },
  audioTextRight: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
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
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
