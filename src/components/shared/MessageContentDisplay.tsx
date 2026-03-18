import React, { useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Message } from '@/types';
import { colors, spacing, radius, typography } from '@/theme-redesign';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MessageContentDisplayProps {
  message: Message;
  variant: 'feed' | 'fullscreen';
  renderAfterMedia?: () => React.ReactNode;
}

export default function MessageContentDisplay({ message, variant, renderAfterMedia }: MessageContentDisplayProps) {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const handleAudioToggle = useCallback(async () => {
    if (!message.media_url) return;

    if (playing && sound) {
      await sound.pauseAsync();
      setPlaying(false);
      return;
    }

    if (sound) {
      await sound.playAsync();
      setPlaying(true);
      return;
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: message.media_url },
      { shouldPlay: true }
    );
    setSound(newSound);
    setPlaying(true);

    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlaying(false);
      }
    });
  }, [message.media_url, playing, sound]);

  if (message.content_type === 'photo' && message.media_url) {
    return (
      <View>
        <Image
          source={{ uri: message.media_url }}
          style={variant === 'feed' ? styles.feedImage : styles.fullscreenImage}
          resizeMode={variant === 'feed' ? 'cover' : 'contain'}
        />
        {renderAfterMedia?.()}
        {message.text_content ? (
          <View style={variant === 'feed' ? styles.textContainerFeed : styles.textContainerFullscreen}>
            <Text style={variant === 'feed' ? styles.textContentFeed : styles.textContentFullscreen}>
              {message.text_content}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (message.content_type === 'audio' && message.media_url) {
    return (
      <View>
        <View style={styles.audioContainer}>
          <TouchableOpacity style={styles.audioButton} onPress={handleAudioToggle}>
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={28}
              color={colors.primary.violet}
            />
          </TouchableOpacity>
          <Text style={styles.audioLabel}>Message audio</Text>
        </View>
        {renderAfterMedia?.()}
      </View>
    );
  }

  // Text content
  return (
    <View>
      <View style={variant === 'feed' ? styles.textContainerFeed : styles.textContainerFullscreen}>
        <Text style={variant === 'feed' ? styles.textContentFeed : styles.textContentFullscreen}>
          {message.text_content}
        </Text>
      </View>
      {renderAfterMedia?.()}
    </View>
  );
}

const styles = StyleSheet.create({
  feedImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  audioButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioLabel: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  textContainerFeed: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    minHeight: 120,
    justifyContent: 'center',
  },
  textContainerFullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  textContentFeed: {
    fontSize: typography.sizes.lg,
    color: colors.text.primary,
    lineHeight: 26,
  },
  textContentFullscreen: {
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
});
