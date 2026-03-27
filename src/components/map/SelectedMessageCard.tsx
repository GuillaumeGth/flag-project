import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UndiscoveredMessageMapMeta } from '@/types';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';
import { useTranslation } from 'react-i18next';

const READ_GRADIENT_COLORS = ['rgba(124, 92, 252, 0.4)', 'rgba(167, 139, 250, 0.35)'] as const;
const NAV_GRADIENT_COLORS = ['rgba(0, 229, 255, 0.18)', 'rgba(124, 92, 252, 0.35)'] as const;
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 0 } as const;

interface SelectedMessageCardProps {
  message: UndiscoveredMessageMapMeta;
  isReadable: boolean;
  isLoadingRoute: boolean;
  distance: string | null;
  cardSlideAnim: Animated.Value;
  cardOpacityAnim: Animated.Value;
  bottomOffset: number;
  commentCount?: number;
  onRead: () => void;
  onNavigate: () => void;
  onClose: () => void;
}

export default function SelectedMessageCard({
  message,
  isReadable,
  isLoadingRoute,
  distance,
  cardSlideAnim,
  cardOpacityAnim,
  bottomOffset,
  commentCount,
  onRead,
  onNavigate,
  onClose,
}: SelectedMessageCardProps) {
  const { t } = useTranslation();
  const animatedStyle = useMemo(() => ({
    opacity: cardOpacityAnim,
    transform: [{ translateY: cardSlideAnim }],
  }), [cardOpacityAnim, cardSlideAnim]);

  return (
    <Animated.View style={[styles.container, { bottom: bottomOffset }, animatedStyle]}>
      <GlassCard withBorder withGlow glowColor="cyan" style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={18} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PremiumAvatar
              uri={message.sender?.avatar_url}
              name={message.sender?.display_name}
              size="small"
              withRing
              ringColor="gradient"
            />
            <View style={styles.senderInfo}>
              <Text style={styles.senderName}>
                {message.sender?.display_name || 'Inconnu'}
              </Text>
              <View style={styles.senderMeta}>
                <Text style={styles.senderLabel}>
                  · {new Date(message.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </Text>
                {commentCount != null && commentCount > 0 && (
                  <View style={styles.commentCountRow}>
                    <Ionicons name="chatbubble-outline" size={11} color={colors.text.tertiary} />
                    <Text style={styles.commentCountText}>{commentCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {isReadable ? (
          <TouchableOpacity onPress={onRead} activeOpacity={0.8} style={styles.actionButton}>
            <LinearGradient
              colors={READ_GRADIENT_COLORS}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.navButton, styles.navButtonReadable]}
            >
              <Ionicons name="eye" size={16} color={colors.primary.violet} />
              <Text style={styles.navButtonText}>{t('map.discoverMessage')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onNavigate}
            activeOpacity={0.8}
            style={styles.actionButton}
            disabled={isLoadingRoute}
          >
            <LinearGradient
              colors={NAV_GRADIENT_COLORS}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={styles.navButton}
            >
              {isLoadingRoute ? (
                <ActivityIndicator size="small" color={colors.primary.cyan} />
              ) : (
                <>
                  <Ionicons name="navigate" size={16} color={colors.primary.cyan} />
                  <Text style={styles.navButtonText}>
                    Itinéraire{distance ? ` · ${distance}` : ''}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  senderLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: 1,
  },
  senderName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    overflow: 'hidden',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  navButtonReadable: {
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  senderInfo: {
    flexDirection: 'column',
  },
  senderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  commentCountText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
});
