import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography, radius, shadows } from '@/theme-redesign';
import { RootStackParamList } from '@/types';
import GlassInput from '@/components/redesign/GlassInput';
import PremiumButton from '@/components/redesign/PremiumButton';

const CONTACT_EMAIL = 'contact@flaag.app';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

export default function ContactScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Message requis', 'Veuillez écrire votre message avant d\'envoyer.');
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
        Alert.alert(
          'Pas de client email',
          `Aucune application email n'est configurée. Vous pouvez nous écrire directement à ${CONTACT_EMAIL}`,
        );
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
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email.');
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Nous contacter</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={40} color={colors.primary.violet} />
          </View>
          <Text style={styles.subtitle}>
            Une question, un bug ou une suggestion ?{'\n'}Écrivez-nous !
          </Text>

          <Text style={styles.label}>Sujet (optionnel)</Text>
          <GlassInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Ex : Bug, Suggestion, Question..."
            borderVariant="default"
            maxLength={100}
          />

          <Text style={styles.label}>Message</Text>
          <GlassInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Décrivez votre demande..."
            borderVariant="accent"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <PremiumButton
            title="Envoyer"
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
        </ScrollView>
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
