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
import { markMessageAsRead } from '@/services/messages';
import { MessageWithSender } from '@/types';

interface Props {
  navigation: any;
  route: {
    params: {
      message: MessageWithSender;
    };
  };
}

export default function ReadMessageScreen({ navigation, route }: Props) {
  const { message } = route.params;
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mark message as read
    markAsRead();

    return () => {
      // Cleanup audio
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const markAsRead = async () => {
    await markMessageAsRead(message.id);
    setLoading(false);
  };

  const playAudio = async () => {
    if (!message.media_url) return;

    try {
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
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
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
              color="#4A90D9"
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
          <Ionicons name="location" size={16} color="#4A90D9" />
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  senderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  audioText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  textContent: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
    marginBottom: 24,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4A90D9',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 16,
  },
  replyButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
