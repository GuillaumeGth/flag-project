import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { OwnFlagMapMeta, MessageContentType } from '@/types';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import AudioPlayerButton from '@/components/AudioPlayerButton';

const CONTENT_ICON: Record<MessageContentType, React.ComponentProps<typeof Ionicons>['name']> = {
  text: 'chatbubble-outline',
  photo: 'image-outline',
  audio: 'mic-outline',
};

interface OwnFlagCardProps {
  flag: OwnFlagMapMeta;
  cardSlideAnim: Animated.Value;
  cardOpacityAnim: Animated.Value;
  bottomOffset: number;
  onClose: () => void;
  onViewConversation?: () => void;
}

export default function OwnFlagCard({
  flag,
  cardSlideAnim,
  cardOpacityAnim,
  bottomOffset,
  onClose,
  onViewConversation,
}: OwnFlagCardProps) {
  const animatedStyle = useMemo(() => ({
    opacity: cardOpacityAnim,
    transform: [{ translateY: cardSlideAnim }],
  }), [cardOpacityAnim, cardSlideAnim]);

  const dateLabel = new Date(flag.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Audio player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleAudio = useCallback(async () => {
    if (!flag.media_url) return;
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: flag.media_url },
          { shouldPlay: true },
        );
        soundRef.current = sound;
        setIsPlaying(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current = null;
          }
        });
      } else if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch {
      // ignore audio errors silently
    }
  }, [flag.media_url, isPlaying]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
    };
  }, [flag.id]);

  const recipientName = flag.recipient?.display_name;

  return (
    <Animated.View style={[styles.container, { bottom: bottomOffset }, animatedStyle]}>
      <GlassCard withBorder withGlow glowColor="violet" style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={18} color="#ffffff" />
        </TouchableOpacity>

        {/* Top row: recipient name · date + visibility badge */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            {recipientName && onViewConversation ? (
              <TouchableOpacity onPress={onViewConversation} activeOpacity={0.7} style={styles.recipientButton}>
                <Text style={styles.recipientName}>{recipientName}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary.cyan} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          {flag.is_public && (
            <View style={styles.badge}>
              <Ionicons name="globe-outline" size={11} color={colors.primary.cyan} />
              <Text style={styles.badgeText}>Public</Text>
            </View>
          )}
        </View>

        {/* Content */}
        {flag.content_type === 'text' && flag.text_content ? (
          <ScrollViewWithScrollbar style={styles.textScroll}>
            <Text style={styles.textContent}>{flag.text_content}</Text>
          </ScrollViewWithScrollbar>
        ) : flag.content_type === 'photo' && flag.media_url ? (
          <Image
            source={{ uri: flag.media_url }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : flag.content_type === 'audio' && flag.media_url ? (
          <View style={styles.audioRow}>
            <AudioPlayerButton isPlaying={isPlaying} onPress={toggleAudio} size="medium" />
            <Text style={styles.audioLabel}>{isPlaying ? 'Lecture...' : 'Ecouter le message'}</Text>
          </View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: 96,
  },
  card: {},
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 36,
    marginBottom: spacing.md,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  recipientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipientName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primary.cyan,
  },
  recipientPlaceholder: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.cyan,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  textScroll: {
    maxHeight: 100,
  },
  textContent: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  audioLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
});
