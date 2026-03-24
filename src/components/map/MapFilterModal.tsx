import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme-redesign';
import type { MapMode } from './MapModePill';
import styles from './MapFilterModal.styles';

export interface FilterPerson {
  id: string;
  display_name?: string | null;
}

export interface ExploreFilters {
  authorIds: string[]; // empty = show all
  visibility: 'all' | 'public' | 'private';
}

export interface MineFilters {
  recipientIds: string[]; // empty = show all; PUBLIC_FLAG_ID = public flags
  readStatus: 'all' | 'read' | 'unread';
  visibility: 'all' | 'public' | 'private';
}

export const PUBLIC_FLAG_ID = '__public__';

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = { authorIds: [], visibility: 'all' };
export const DEFAULT_MINE_FILTERS: MineFilters = { recipientIds: [], readStatus: 'all', visibility: 'all' };

export function isExploreFiltersActive(f: ExploreFilters) {
  return f.authorIds.length > 0 || f.visibility !== 'all';
}

export function isMineFiltersActive(f: MineFilters) {
  return f.recipientIds.length > 0 || f.readStatus !== 'all' || f.visibility !== 'all';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  mode: MapMode;
  // Explore
  authors: FilterPerson[];
  exploreFilters: ExploreFilters;
  onExploreFiltersChange: (f: ExploreFilters) => void;
  // Mine
  recipients: FilterPerson[];
  hasPublicFlags: boolean;
  mineFilters: MineFilters;
  onMineFiltersChange: (f: MineFilters) => void;
}

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 0 } as const;
const ACTIVE_GRADIENT = ['rgba(124, 92, 252, 0.85)', 'rgba(0, 200, 255, 0.7)'] as const;

const READ_STATUS_OPTIONS: { label: string; value: MineFilters['readStatus'] }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Lus', value: 'read' },
  { label: 'Non lus', value: 'unread' },
];

const VISIBILITY_OPTIONS: { label: string; value: 'all' | 'public' | 'private' }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Public', value: 'public' },
  { label: 'Privé', value: 'private' },
];

function PersonChip({
  person,
  selected,
  onToggle,
}: {
  person: FilterPerson;
  selected: boolean;
  onToggle: () => void;
}) {
  const initials = (person.display_name ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onToggle} style={styles.chip}>
      {selected ? (
        <LinearGradient colors={ACTIVE_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.chipInner}>
          <View style={styles.chipAvatar}>
            <Text style={styles.chipAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.chipLabelActive} numberOfLines={1}>{person.display_name ?? 'Inconnu'}</Text>
          <Ionicons name="checkmark" size={14} color={colors.text.primary} />
        </LinearGradient>
      ) : (
        <View style={styles.chipInnerInactive}>
          <View style={styles.chipAvatar}>
            <Text style={styles.chipAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.chipLabelInactive} numberOfLines={1}>{person.display_name ?? 'Inconnu'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MapFilterModal({
  visible,
  onClose,
  mode,
  authors,
  exploreFilters,
  onExploreFiltersChange,
  recipients,
  hasPublicFlags,
  mineFilters,
  onMineFiltersChange,
}: Props) {
  function toggleAuthor(id: string) {
    const next = exploreFilters.authorIds.includes(id)
      ? exploreFilters.authorIds.filter(a => a !== id)
      : [...exploreFilters.authorIds, id];
    onExploreFiltersChange({ ...exploreFilters, authorIds: next });
  }

  function toggleRecipient(id: string) {
    const next = mineFilters.recipientIds.includes(id)
      ? mineFilters.recipientIds.filter(r => r !== id)
      : [...mineFilters.recipientIds, id];
    onMineFiltersChange({ ...mineFilters, recipientIds: next });
  }

  function setReadStatus(status: MineFilters['readStatus']) {
    onMineFiltersChange({ ...mineFilters, readStatus: status });
  }

  function setExploreVisibility(v: ExploreFilters['visibility']) {
    onExploreFiltersChange({ ...exploreFilters, visibility: v });
  }

  function setMineVisibility(v: MineFilters['visibility']) {
    onMineFiltersChange({ ...mineFilters, visibility: v });
  }

  function handleReset() {
    if (mode === 'explore') {
      onExploreFiltersChange(DEFAULT_EXPLORE_FILTERS);
    } else {
      onMineFiltersChange(DEFAULT_MINE_FILTERS);
    }
  }

  const isActive = mode === 'explore'
    ? isExploreFiltersActive(exploreFilters)
    : isMineFiltersActive(mineFilters);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <BlurView intensity={50} tint="dark" style={styles.sheetBlur}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'explore' ? 'Filtrer par auteur' : 'Filtrer les flaags'}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ─── Explore mode: visibility + author filter ─── */}
            {mode === 'explore' && (
              <>
                {/* Visibility */}
                <Text style={styles.sectionLabel}>Visibilité</Text>
                <View style={styles.segmentRow}>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.75}
                      style={styles.segmentItem}
                      onPress={() => setExploreVisibility(opt.value)}
                    >
                      {exploreFilters.visibility === opt.value ? (
                        <LinearGradient
                          colors={ACTIVE_GRADIENT}
                          start={GRADIENT_START}
                          end={GRADIENT_END}
                          style={styles.segmentActive}
                        >
                          <Text style={styles.segmentLabelActive}>{opt.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.segmentInactive}>
                          <Text style={styles.segmentLabelInactive}>{opt.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Author filter */}
                {authors.length > 0 && (
                  <>
                    <Text style={styles.sectionLabelSpaced}>Auteur</Text>
                    <View style={styles.chipsWrap}>
                      {authors.map(author => (
                        <PersonChip
                          key={author.id}
                          person={author}
                          selected={exploreFilters.authorIds.includes(author.id)}
                          onToggle={() => toggleAuthor(author.id)}
                        />
                      ))}
                    </View>
                  </>
                )}
                {authors.length === 0 && exploreFilters.visibility === 'all' && (
                  <Text style={styles.emptyHint}>Aucun message à proximité</Text>
                )}
              </>
            )}

            {/* ─── Mine mode: visibility + recipient + read status ─── */}
            {mode === 'mine' && (
              <>
                {/* Visibility */}
                <Text style={styles.sectionLabel}>Visibilité</Text>
                <View style={styles.segmentRow}>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.75}
                      style={styles.segmentItem}
                      onPress={() => setMineVisibility(opt.value)}
                    >
                      {mineFilters.visibility === opt.value ? (
                        <LinearGradient
                          colors={ACTIVE_GRADIENT}
                          start={GRADIENT_START}
                          end={GRADIENT_END}
                          style={styles.segmentActive}
                        >
                          <Text style={styles.segmentLabelActive}>{opt.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.segmentInactive}>
                          <Text style={styles.segmentLabelInactive}>{opt.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Read status */}
                <Text style={styles.sectionLabelSpaced}>Statut</Text>
                <View style={styles.segmentRow}>
                  {READ_STATUS_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.75}
                      style={styles.segmentItem}
                      onPress={() => setReadStatus(opt.value)}
                    >
                      {mineFilters.readStatus === opt.value ? (
                        <LinearGradient
                          colors={ACTIVE_GRADIENT}
                          start={GRADIENT_START}
                          end={GRADIENT_END}
                          style={styles.segmentActive}
                        >
                          <Text style={styles.segmentLabelActive}>{opt.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.segmentInactive}>
                          <Text style={styles.segmentLabelInactive}>{opt.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Recipient filter */}
                {(recipients.length > 0 || hasPublicFlags) && (
                  <>
                    <Text style={styles.sectionLabelSpaced}>Destinataire</Text>
                    <View style={styles.chipsWrap}>
                      {hasPublicFlags && (
                        <PersonChip
                          person={{ id: PUBLIC_FLAG_ID, display_name: 'Public' }}
                          selected={mineFilters.recipientIds.includes(PUBLIC_FLAG_ID)}
                          onToggle={() => toggleRecipient(PUBLIC_FLAG_ID)}
                        />
                      )}
                      {recipients.map(r => (
                        <PersonChip
                          key={r.id}
                          person={r}
                          selected={mineFilters.recipientIds.includes(r.id)}
                          onToggle={() => toggleRecipient(r.id)}
                        />
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Reset */}
          {isActive && (
            <TouchableOpacity onPress={handleReset} activeOpacity={0.8} style={styles.resetBtn}>
              <Ionicons name="refresh" size={15} color={colors.primary.violet} />
              <Text style={styles.resetLabel}>Réinitialiser</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </View>
    </Modal>
  );
}
