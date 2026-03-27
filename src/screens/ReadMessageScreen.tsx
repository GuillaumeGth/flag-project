import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markMessageAsRead, fetchMessageById, markPublicMessageDiscovered } from '@/services/messages';
import { MessageWithSender, RootStackParamList } from '@/types';
import { colors } from '@/theme-redesign';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadMessage'>;

export default function ReadMessageScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [message, setMessage] = useState<MessageWithSender | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAndMarkAsRead();

    return () => {
      // Cleanup audio
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadAndMarkAsRead = async () => {
    const currentMessage = await fetchMessageById(route.params.messageId);
    if (currentMessage) {
      setMessage(currentMessage);
      if (currentMessage.is_public) {
        await markPublicMessageDiscovered(currentMessage.id);
      }
      await markMessageAsRead(currentMessage.id, currentMessage.sender_id);
    }
    setLoading(false);
  };

  const playAudio = async () => {
    if (!message?.media_url) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: message.media_url },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch {
      // audio playback errors are non-critical
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.cyan} />
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={64} color={colors.text.tertiary} />
        <Text style={styles.errorText}>{t('readMessage.notFound')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('readMessage.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.senderName}>
            {message.sender?.display_name || 'Utilisateur'}
          </Text>
          <Text style={styles.date}>{formatDate(message.created_at)}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollViewWithScrollbar style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Photo content */}
        {message.content_type === 'photo' && message.media_url && (
          <Image source={{ uri: message.media_url }} style={styles.image} />
        )}

        {/* Audio content */}
        {message.content_type === 'audio' && message.media_url && (
          <TouchableOpacity style={styles.audioPlayer} onPress={playAudio}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={64}
              color={colors.primary.cyan}
            />
            <Text style={styles.audioText}>
              {isPlaying ? 'En lecture...' : 'Appuyez pour écouter'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Text content */}
        {message.text_content && (
          <Text style={styles.textContent}>{message.text_content}</Text>
        )}

        <View style={styles.locationBadge}>
          <Ionicons name="location" size={16} color={colors.primary.cyan} />
          <Text style={styles.locationText}>
            Message découvert à cet endroit
          </Text>
        </View>
      </ScrollViewWithScrollbar>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() =>
            navigation.navigate('Conversation', {
              otherUserId: message.sender_id,
              otherUserName: message.sender?.display_name ?? '',
              otherUserAvatarUrl: message.sender?.avatar_url ?? undefined,
            })
          }
        >
          <Ionicons name="arrow-undo" size={20} color="#fff" />
          <Text style={styles.replyButtonText}>{t('readMessage.reply')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  senderName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  date: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioPlayer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text.secondary,
  },
  textContent: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text.primary,
    marginBottom: 24,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: 12,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.primary.cyan,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.cyan,
    borderRadius: 12,
    padding: 16,
  },
  replyButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: colors.primary.cyan,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
