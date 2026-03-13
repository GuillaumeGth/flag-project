import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UndiscoveredMessageMapMeta } from '@/types';
import { MessageCluster } from '@/hooks/useClusteredMarkers';
import { colors, spacing, radius } from '@/theme-redesign';
import { formatMessageDate } from '@/utils/date';

interface ClusterPickerModalProps {
  cluster: MessageCluster | null;
  onSelect: (message: UndiscoveredMessageMapMeta) => void;
  onClose: () => void;
  labelMap?: Record<string, string>;
}

export default function ClusterPickerModal({ cluster, onSelect, onClose, labelMap }: ClusterPickerModalProps) {
  const insets = useSafeAreaInsets();
  if (!cluster) return null;

  const sender = cluster.messages[0].sender;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <View style={styles.header}>
              <Image source={{ uri: cluster.senderAvatarUrl ?? undefined }} style={styles.avatar} />
              <View style={styles.headerText}>
                <Text style={styles.senderName}>{sender?.display_name ?? 'Utilisateur'}</Text>
                <Text style={styles.subtitle}>{cluster.messages.length} Flaags au même endroit</Text>
              </View>
            </View>

            <FlatList
              data={cluster.messages}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.itemIcon}>
                    <Ionicons
                      name={item.is_public ? 'earth' : 'lock-closed'}
                      size={14}
                      color={item.is_public ? colors.primary.violet : colors.primary.cyan}
                    />
                  </View>
                  <Text style={styles.itemLabel}>{labelMap?.[item.id] ?? `Flaag ${index + 1}`}</Text>
                  <Text style={styles.itemDate}>{formatMessageDate(item.created_at)}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.glass,
  },
  headerText: {
    flex: 1,
  },
  senderName: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  itemDate: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
