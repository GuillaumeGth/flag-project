import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography, radius } from '@/theme-redesign';
import { RootStackParamList } from '@/types';
import GlassCard from '@/components/redesign/GlassCard';
import GlassInput from '@/components/redesign/GlassInput';
import PremiumButton from '@/components/redesign/PremiumButton';
import { useTranslation } from 'react-i18next';
import { i18next, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, SupportedLanguage, saveLanguage } from '@/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, signOut, updateDisplayName } = useAuth();
  const { t } = useTranslation();
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(
    (i18next.language as SupportedLanguage) ?? 'fr'
  );

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    await updateDisplayName(newName.trim());
    setSavingName(false);
    setEditNameVisible(false);
  };

  const handleSignOut = () => setSignOutDialogVisible(true);

  const handleSelectLanguage = async (lang: SupportedLanguage) => {
    await i18next.changeLanguage(lang);
    await saveLanguage(lang);
    setCurrentLang(lang);
    setLangModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <ConfirmDialog
        visible={signOutDialogVisible}
        title={t('settings.signOutTitle')}
        message={t('settings.signOutMessage')}
        confirmLabel={t('settings.signOutConfirm')}
        cancelLabel={t('settings.cancel')}
        destructive
        onConfirm={signOut}
        onCancel={() => setSignOutDialogVisible(false)}
      />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setNewName(user?.display_name || ''); setEditNameVisible(true); }}>
          <Ionicons name="person-outline" size={24} color={colors.text.primary} />
          <Text style={styles.menuText}>{t('settings.editName')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          <Text style={styles.menuText}>{t('settings.notificationsMenu')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Privacy')}>
          <Ionicons name="shield-outline" size={24} color={colors.text.primary} />
          <Text style={styles.menuText}>{t('settings.privacy')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Contact')}>
          <Ionicons name="mail-outline" size={24} color={colors.text.primary} />
          <Text style={styles.menuText}>{t('settings.contact')}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setLangModalVisible(true)}>
          <Ionicons name="language-outline" size={24} color={colors.text.primary} />
          <Text style={styles.menuText}>{t('settings.language')}</Text>
          <Text style={styles.langCurrent}>{LANGUAGE_LABELS[currentLang]}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={24} color={colors.error} />
        <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        Fläag v{Application.nativeApplicationVersion ?? '—'}
      </Text>

      {/* Edit name modal */}
      <Modal visible={editNameVisible} transparent animationType="fade" onRequestClose={() => setEditNameVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlur} />
          <GlassCard style={styles.modalCard} withBorder withGlow glowColor="cyan">
            <Text style={styles.modalTitle}>{t('settings.editNameTitle')}</Text>
            <View style={styles.inputContainer}>
              <GlassInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder={t('settings.namePlaceholder')}
                borderVariant="accent"
                autoFocus
                maxLength={50}
              />
            </View>
            <View style={styles.modalButtons}>
              <PremiumButton title={t('settings.cancel')} variant="ghost" onPress={() => setEditNameVisible(false)} disabled={savingName} style={styles.modalButton} />
              <PremiumButton title={t('settings.save')} variant="gradient" onPress={handleSaveName} loading={savingName} disabled={savingName} style={styles.modalButton} withGlow />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Language picker modal */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlur} />
          <GlassCard style={styles.modalCard} withBorder withGlow glowColor="cyan">
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, currentLang === lang && styles.langOptionActive]}
                onPress={() => handleSelectLanguage(lang)}
              >
                <Text style={[styles.langOptionText, currentLang === lang && styles.langOptionTextActive]}>
                  {LANGUAGE_LABELS[lang]}
                </Text>
                {currentLang === lang && (
                  <Ionicons name="checkmark" size={20} color={colors.primary.cyan} />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <PremiumButton title={t('settings.cancel')} variant="ghost" onPress={() => setLangModalVisible(false)} style={styles.modalButton} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
  menuSection: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: colors.text.primary,
  },
  langCurrent: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginRight: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  signOutText: {
    marginLeft: 16,
    fontSize: 16,
    color: colors.error,
  },
  version: {
    textAlign: 'center',
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 'auto',
    paddingBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay.dark,
  },
  modalBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalCard: {
    width: '85%',
    maxWidth: 400,
    padding: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  modalInput: {
    backgroundColor: colors.surface.glassDark,
    padding: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  langOptionActive: {
    backgroundColor: colors.surface.glassDark,
  },
  langOptionText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  langOptionTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});
