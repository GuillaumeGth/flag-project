import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import Toast from '@/components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography, radius, shadows } from '@/theme-redesign';
import { RootStackParamList } from '@/types';
import GlassInput from '@/components/redesign/GlassInput';
import PremiumButton from '@/components/redesign/PremiumButton';
import { useTranslation } from 'react-i18next';

const CONTACT_EMAIL = 'contact@flaag.app';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

export default function ContactScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'error';
  }>({ visible: false, message: '', type: 'warning' });

  const showToast = useCallback((msg: string, type: 'success' | 'warning' | 'error') => {
    setToast({ visible: true, message: msg, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSend = async () => {
    if (!message.trim()) {
      showToast('Écris ton message avant d\'envoyer', 'warning');
      return;
    }

    setSending(true);

    const userInfo = user?.display_name || user?.phone || user?.email || 'Utilisateur';
    const body = `${message.trim()}\n\n---\nEnvoyé depuis Fläag par ${userInfo}`;
    const subjectLine = subject.trim() || 'Contact depuis Fläag';

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        showToast(`Aucune app email configurée — écris-nous à ${CONTACT_EMAIL}`, 'warning');
        setSending(false);
        return;
      }
      await Linking.openURL(mailto);
      // Small delay before going back so the mail app has time to open
      setTimeout(() => {
        setSending(false);
        navigation.goBack();
      }, 500);
    } catch {
      showToast("Impossible d'ouvrir l'application email", 'error');
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('contact.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollViewWithScrollbar
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={40} color={colors.primary.violet} />
          </View>
          <Text style={styles.subtitle}>
            Une question, un bug ou une suggestion ?{'\n'}Écrivez-nous !
          </Text>

          <Text style={styles.label}>{t('contact.subjectLabel')}</Text>
          <GlassInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('contact.subjectPlaceholder')}
            borderVariant="default"
            maxLength={100}
          />

          <Text style={styles.label}>{t('contact.messageLabel')}</Text>
          <GlassInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder={t('contact.messagePlaceholder')}
            borderVariant="accent"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <PremiumButton
            title={t('contact.send')}
            variant="gradient"
            onPress={handleSend}
            loading={sending}
            disabled={sending || !message.trim()}
            withGlow
            style={styles.sendButton}
          />

          <Text style={styles.emailHint}>
            Ou écrivez-nous directement à{' '}
            <Text style={styles.emailLink}>{CONTACT_EMAIL}</Text>
          </Text>
        </ScrollViewWithScrollbar>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
    ...shadows.glowViolet,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface.glassDark,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  messageInput: {
    minHeight: 140,
    paddingTop: spacing.lg,
  },
  sendButton: {
    marginTop: spacing.md,
  },
  emailHint: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  emailLink: {
    color: colors.primary.violet,
    fontWeight: '600',
  },
});
