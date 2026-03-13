import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPrivacySettings, updatePrivacySetting, PrivacySettings } from '@/services/privacy';
import { colors } from '@/theme-redesign';
import { RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacy'>;

const SETTINGS: {
  key: keyof PrivacySettings;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  invertedLogic?: boolean;
}[] = [
  {
    key: 'is_private',
    label: 'Compte privé',
    description:
      'Seuls tes abonnés peuvent voir tes messages publics sur la carte.',
    icon: 'lock-closed-outline',
  },
  {
    key: 'is_searchable',
    label: 'Apparaître dans les recherches',
    description: 'Les autres utilisateurs peuvent te trouver via la recherche.',
    icon: 'search-outline',
  },
];

export default function PrivacyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof PrivacySettings | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchPrivacySettings(user.id).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [user?.id]);

  const handleToggle = useCallback(
    async (field: keyof PrivacySettings, value: boolean) => {
      if (!user?.id || !settings) return;
      setSaving(field);
      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
      const ok = await updatePrivacySetting(user.id, field, value);
      if (!ok) {
        // Revert on failure
        setSettings((prev) => (prev ? { ...prev, [field]: !value } : prev));
      }
      setSaving(null);
    },
    [user?.id, settings],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Confidentialité</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary.violet}
          style={styles.loader}
        />
      ) : (
        <View style={styles.section}>
          {SETTINGS.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.row,
                index < SETTINGS.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={22} color={colors.primary.violet} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDescription}>{item.description}</Text>
              </View>
              {saving === item.key ? (
                <ActivityIndicator size="small" color={colors.primary.violet} />
              ) : (
                <Switch
                  value={settings?.[item.key] ?? false}
                  onValueChange={(v) => handleToggle(item.key, v)}
                  trackColor={{
                    false: colors.surface.glassDark,
                    true: colors.primary.violetDark,
                  }}
                  thumbColor={
                    settings?.[item.key]
                      ? colors.primary.violetLight
                      : colors.text.disabled
                  }
                />
              )}
            </View>
          ))}
        </View>
      )}
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
  loader: {
    marginTop: 48,
  },
  section: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 3,
    lineHeight: 18,
  },
});
