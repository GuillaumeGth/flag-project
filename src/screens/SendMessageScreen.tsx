import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import Toast from '@/components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage, uploadMedia } from '@/services/messages';
import { Coordinates, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'SendMessage'>;

type Recipient = { id: string; name: string };

export default function SendMessageScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current: userLocation } = useLocation();

  // Store content params in state so they survive route.params updates
  // (when SelectRecipientScreen navigates back with { recipients }, the native stack
  // can replace params, wiping contentType/textContent/mediaUri and hiding the preview)
  const [contentType] = useState(() => route.params?.contentType);
  const [textContent] = useState(() => route.params?.textContent);
  const [mediaUri] = useState(() => route.params?.mediaUri);

  // adminLocation comes from route params (set by CreateMessageScreen)
  const [adminLocation] = useState<Coordinates | null>(
    () => (user?.is_admin && route.params?.adminLocation ? route.params.adminLocation : null)
  );
  const effectiveLocation = adminLocation ?? userLocation;

  const [recipients, setRecipients] = useState<Recipient[]>(route.params?.recipients ?? []);
  const [isPublic, setIsPublic] = useState((route.params?.recipients ?? []).length === 0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'error';
    action?: { label: string; onPress: () => void };
  }>({ visible: false, message: '', type: 'success' });

  // Receive recipients back from SelectRecipientScreen
  useEffect(() => {
    if (route.params?.recipients) {
      setRecipients(route.params.recipients);
      setIsPublic(false);
    }
  }, [route.params?.recipients]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error', action?: { label: string; onPress: () => void }) => {
      setToast({ visible: true, message, type, action });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSend = useCallback(async () => {
    if (!effectiveLocation) {
      showToast('Position GPS non disponible', 'error');
      return;
    }

    if (!isPublic && recipients.length === 0) {
      showToast('Sélectionne au moins un destinataire', 'error', {
        label: 'Choisir',
        onPress: () => navigation.navigate('SelectRecipient', { mode: 'flag' }),
      });
      return;
    }

    setLoading(true);

    try {
      let uploadedMediaUrl: string | undefined;

      if (mediaUri && contentType !== 'text') {
        const url = await uploadMedia(mediaUri, contentType as 'photo' | 'audio');
        if (!url) {
          showToast("Échec de l'upload du média", 'error', { label: 'Réessayer', onPress: handleSend });
          setLoading(false);
          return;
        }
        uploadedMediaUrl = url;
      }

      const isAdminPlaced = !!adminLocation;

      if (isPublic) {
        const result = await sendMessage(
          null,
          contentType ?? 'text',
          effectiveLocation,
          textContent ?? undefined,
          uploadedMediaUrl,
          true,
          null,
          isAdminPlaced
        );
        if (result) {
          navigation.navigate('Main', {
            screen: 'Map',
            params: {
              toast: { message: 'Flag déposé !', type: 'success' },
              ...(isAdminPlaced ? { mine: true } : {}),
            },
          });
          return;
        }
      } else {
        const results = await Promise.all(
          recipients.map((r) =>
            sendMessage(
              r.id,
              contentType ?? 'text',
              effectiveLocation,
              textContent ?? undefined,
              uploadedMediaUrl,
              false,
              null,
              isAdminPlaced
            )
          )
        );
        const successCount = results.filter(Boolean).length;
        if (successCount > 0) {
          const msg =
            successCount === recipients.length
              ? 'Flag privé envoyé !'
              : `Envoyé à ${successCount}/${recipients.length}`;
          navigation.navigate('Main', {
            screen: 'Map',
            params: {
              toast: { message: msg, type: successCount === recipients.length ? 'success' : 'warning' },
              ...(isAdminPlaced ? { mine: true } : {}),
            },
          });
          return;
        }
      }

      showToast("Échec de l'envoi", 'error', { label: 'Réessayer', onPress: handleSend });
    } catch {
      showToast('Une erreur est survenue', 'error', { label: 'Réessayer', onPress: handleSend });
    }

    setLoading(false);
  }, [effectiveLocation, isPublic, recipients, mediaUri, contentType, textContent, adminLocation, navigation, showToast]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        action={toast.action}
        onHide={hideToast}
      />
      <ScrollViewWithScrollbar style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.header, { marginTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Ionicons name="send" size={16} color="#FFFFFF" />
            <Text style={styles.title}>{t('sendMessage.title')}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Admin placement badge */}
        {adminLocation && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>{t('sendMessage.adminBadge')}</Text>
            <Text style={styles.adminBadgeCoords}>
              {adminLocation.latitude.toFixed(5)}, {adminLocation.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Content preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>{t('sendMessage.preview')}</Text>

          {contentType === 'photo' && mediaUri ? (
            <View style={styles.mediaPreview}>
              <Image source={{ uri: mediaUri }} style={styles.previewImage} />
              {textContent ? (
                <View style={styles.previewTextOverlay}>
                  <Text style={styles.previewTextOverlayContent} numberOfLines={2}>
                    {textContent}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : contentType === 'audio' && mediaUri ? (
            <View style={styles.audioPreview}>
              <View style={styles.audioIcon}>
                <Ionicons name="mic" size={22} color={colors.primary.cyan} />
              </View>
              <View style={styles.audioInfo}>
                <Text style={styles.audioTitle}>{t('sendMessage.audioTitle')}</Text>
                {textContent ? (
                  <Text style={styles.audioSubtitle} numberOfLines={1}>
                    {textContent}
                  </Text>
                ) : null}
              </View>
              <View style={styles.audioWave}>
                {WAVEFORM_BARS.map((h, i) => (
                  <View key={i} style={[styles.waveBar, { height: h }]} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.textPreview}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.text.secondary} style={styles.textPreviewIcon} />
              <Text style={styles.textPreviewContent} numberOfLines={4}>
                {textContent}
              </Text>
            </View>
          )}
        </View>

        {/* Public / Privé toggle */}
        <View style={styles.section}>
          <View style={styles.publicToggleRow}>
            <Ionicons
              name="globe-outline"
              size={18}
              color={isPublic ? colors.primary.cyan : colors.text.secondary}
            />
            <Text style={[styles.publicToggleLabel, isPublic && { color: colors.primary.cyan }]}>
              Public
            </Text>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.border.default, true: colors.primary.cyan }}
              thumbColor={colors.text.primary}
            />
          </View>
          <Text style={styles.publicToggleHint}>
            {isPublic
              ? 'Visible par tous les utilisateurs à proximité'
              : 'Visible uniquement par les destinataires sélectionnés'}
          </Text>
        </View>

        {/* Destinataires (mode privé) */}
        {!isPublic && (
          <TouchableOpacity
            style={styles.recipientRow}
            onPress={() => navigation.navigate('SelectRecipient', { mode: 'flag' })}
          >
            <Ionicons name="people-outline" size={18} color={colors.text.secondary} />
            <Text style={styles.recipientLabel}>{t('sendMessage.to')}</Text>
            <Text style={styles.recipientName} numberOfLines={1}>
              {recipients.length > 0
                ? recipients.map((r) => r.name).join(', ')
                : 'Sélectionner des destinataires'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButtonContainer, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendButton}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>{t('sendMessage.send')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollViewWithScrollbar>
    </View>
  );
}

// Static decorative waveform bars for the audio preview
const WAVEFORM_BARS: number[] = [6, 10, 14, 8, 12, 16, 10, 6, 14, 8];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  previewSection: {
    marginBottom: spacing.xl,
  },
  previewLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  mediaPreview: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
  },
  previewTextOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  previewTextOverlayContent: {
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  audioIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  audioSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  audioWave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary.cyan,
    opacity: 0.6,
  },
  textPreview: {
    flexDirection: 'row',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  textPreviewIcon: {
    marginTop: 2,
  },
  textPreviewContent: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.md,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  publicToggleLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  publicToggleHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  recipientLabel: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  recipientName: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  sendButtonContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
    ...shadows.medium,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sendButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadge: {
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: 2,
  },
  adminBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#FFD700',
  },
  adminBadgeCoords: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
});
