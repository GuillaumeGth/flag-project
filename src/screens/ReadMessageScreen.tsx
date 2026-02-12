import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { markMessageAsRead, fetchMessageById, markPublicMessageDiscovered } from '@/services/messages';
import { MessageWithSender } from '@/types';
import { colors } from '@/theme';

interface Props {
  navigation: any;
  route: {
    params: {
      message?: MessageWithSender;
      messageId?: string;
    };
  };
}

export default function ReadMessageScreen({ navigation, route }: Props) {
  const [message, setMessage] = useState<MessageWithSender | null>(route.params.message || null);
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
    let currentMessage = message;

    // If we only have messageId, fetch the full message
    if (!currentMessage && route.params.messageId) {
      currentMessage = await fetchMessageById(route.params.messageId);
      if (currentMessage) {
        setMessage(currentMessage);
      }
    }

    if (currentMessage) {
      if (currentMessage.is_public) {
        await markPublicMessageDiscovered(currentMessage.id);
      }
      await markMessageAsRead(currentMessage.id);
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
    } catch (error) {
      console.error('Error playing audio:', error);
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={64} color={colors.textMuted} />
        <Text style={styles.errorText}>Message introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.senderName}>
            {message.sender?.display_name || 'Utilisateur'}
          </Text>
          <Text style={styles.date}>{formatDate(message.created_at)}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
              color={colors.primary}
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
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.locationText}>
            Message découvert à cet endroit
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() =>
            navigation.navigate('CreateMessage', {
              recipientId: message.sender_id,
              recipientName: message.sender?.display_name,
            })
          }
        >
          <Ionicons name="arrow-undo" size={20} color="#fff" />
          <Text style={styles.replyButtonText}>Répondre ici</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  senderName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  textContent: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.primary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
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
