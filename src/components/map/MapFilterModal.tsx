import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { ScrollViewWithScrollbar } from '@/components/ScrollableWithScrollbar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme-redesign';
import type { MapMode } from './MapModePill';
import styles from './MapFilterModal.styles';
import BottomSheet from '@/components/BottomSheet';

export interface FilterPerson {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  messageCount?: number;
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
export const DEFAULT_MINE_FILTERS: MineFilters = { recipientIds: [], readStatus: 'unread', visibility: 'all' };

export function isExploreFiltersActive(f: ExploreFilters) {
  return f.authorIds.length > 0 || f.visibility !== 'all';
}

export function isMineFiltersActive(f: MineFilters) {
  return (
    f.recipientIds.length > 0 ||
    f.readStatus !== DEFAULT_MINE_FILTERS.readStatus ||
    f.visibility !== DEFAULT_MINE_FILTERS.visibility
  );
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
const MAX_VISIBLE_PILLS = 3;

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

function getInitials(person: FilterPerson): string {
  return (person.display_name ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

function PersonAvatar({
  person,
  size,
  active,
}: {
  person: FilterPerson;
  size: number;
  active: boolean;
}) {
  const fontSize = Math.round(size * 0.35);
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: active ? 'rgba(167, 139, 250, 0.25)' : colors.message.discovered,
  };

  if (person.id === PUBLIC_FLAG_ID) {
    return (
      <View style={containerStyle}>
        <Ionicons name="globe-outline" size={size * 0.45} color={active ? colors.text.primary : colors.text.tertiary} />
      </View>
    );
  }

  if (person.avatar_url) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={{ color: active ? colors.text.primary : colors.text.secondary, fontSize, fontWeight: '700' }}>
        {getInitials(person)}
      </Text>
    </View>
  );
}

// ─── Person list with custom scrollbar ───────────────────────────────────────

function PersonList({
  suggestions,
  selectedIds,
  onToggle,
}: {
  suggestions: FilterPerson[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  query: string;
}) {
  return (
    <ScrollViewWithScrollbar keyboardShouldPersistTaps="handled">
      {suggestions.map((person, index) => {
        const sel = selectedIds.includes(person.id);
        const isLast = index === suggestions.length - 1;
        return (
          <TouchableOpacity
            key={person.id}
            onPress={() => onToggle(person.id)}
            activeOpacity={0.7}
            style={[
              styles.personRow,
              !isLast && styles.personRowBorder,
              sel && styles.personRowActive,
            ]}
          >
            <PersonAvatar person={person} size={34} active={sel} />
            <Text
              style={[styles.personName, sel && styles.personNameActive]}
              numberOfLines={1}
            >
              {person.display_name ?? 'Inconnu'}
            </Text>
            {person.messageCount !== undefined && (
              <Text style={styles.personCount}>{person.messageCount}</Text>
            )}
            <View style={styles.personCheck}>
              {sel ? (
                <LinearGradient
                  colors={ACTIVE_GRADIENT}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={styles.personCheckFill}
                >
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.personCheckEmpty} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollViewWithScrollbar>
  );
}

// ─── Person Search Picker ────────────────────────────────────────────────────

function PersonSearchPicker({
  people,
  selectedIds,
  onToggle,
  onClearAll,
  emptyLabel = 'Aucun contact disponible',
}: {
  people: FilterPerson[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const suggestions = q
    ? people.filter(p => (p.display_name ?? '').toLowerCase().includes(q))
    : people;

  const selectedPeople = people.filter(p => selectedIds.includes(p.id));
  const overflow = selectedPeople.length - MAX_VISIBLE_PILLS;

  return (
    <View style={styles.pickerRoot}>
      {/* ── Selected summary ── */}
      {selectedPeople.length > 0 && (
        <View style={styles.selectedRow}>
          {selectedPeople.length <= MAX_VISIBLE_PILLS ? (
            <View style={styles.selectedRowContent}>
              {selectedPeople.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => onToggle(p.id)}
                  activeOpacity={0.75}
                  style={styles.selectedPill}
                >
                  <LinearGradient
                    colors={ACTIVE_GRADIENT}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={styles.selectedPillInner}
                  >
                    <PersonAvatar person={p} size={18} active={true} />
                    <Text style={styles.pillLabel} numberOfLines={1}>
                      {p.display_name ?? 'Inconnu'}
                    </Text>
                    <Ionicons name="close" size={11} color="rgba(255,255,255,0.7)" />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.selectedSummary}>
              <View style={styles.selectedAvatarStack}>
                {selectedPeople.slice(0, 3).map((p, i) => (
                  <View key={p.id} style={[styles.selectedAvatarItem, { marginLeft: i === 0 ? 0 : -8 }]}>
                    <Text style={styles.selectedAvatarItemText}>{getInitials(p)}</Text>
                  </View>
                ))}
                {overflow > 0 && (
                  <View style={[styles.selectedAvatarItem, styles.selectedAvatarOverflow, { marginLeft: -8 }]}>
                    <Text style={styles.selectedAvatarOverflowText}>+{overflow}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.selectedSummaryLabel}>
                {selectedPeople.length} sélectionnés
              </Text>
              <TouchableOpacity onPress={onClearAll} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.selectedClearLabel}>Effacer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Search input ── */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={15} color={colors.text.tertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher..."
          placeholderTextColor={colors.text.disabled}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Caption ── */}
      {people.length > 0 && (
        <Text style={styles.searchCaption}>
          {q
            ? `${suggestions.length} résultat${suggestions.length > 1 ? 's' : ''}`
            : `${people.length} contact${people.length > 1 ? 's' : ''}`}
        </Text>
      )}

      {/* ── Scrollable list (only this part scrolls) ── */}
      <View style={styles.personListCard}>
        {suggestions.length > 0 ? (
          <PersonList
            suggestions={suggestions}
            selectedIds={selectedIds}
            onToggle={onToggle}
            query={query}
          />
        ) : (
          <Text style={styles.emptyHint}>
            {q ? `Aucun résultat pour "${query}"` : emptyLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Segment control (shared) ─────────────────────────────────────────────────

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          activeOpacity={0.75}
          style={styles.segmentItem}
          onPress={() => onChange(opt.value)}
        >
          {value === opt.value ? (
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
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

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
  // Animation is handled by BottomSheet

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

  const allRecipients: FilterPerson[] = [
    ...(hasPublicFlags ? [{ id: PUBLIC_FLAG_ID, display_name: 'Public' }] : []),
    ...recipients,
  ];

  const hasPeople = mode === 'explore' ? authors.length > 0 : allRecipients.length > 0;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="80%"
      hideHandle
      sheetStyle={styles.sheet}
    >
      <View
        style={[styles.sheetBlur, { paddingBottom: spacing.md }]}
        onStartShouldSetResponder={() => true}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>Filtres</Text>
                {isActive && (
                  <TouchableOpacity onPress={handleReset} activeOpacity={0.7} style={styles.resetIconBtn}>
                    <Ionicons name="refresh" size={15} color={colors.primary.violet} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* ── Static filters (not scrollable) ── */}
            <View style={styles.staticContent}>
              {mode === 'explore' && (
                <>
                  <Text style={styles.sectionLabel}>Visibilité</Text>
                  <SegmentControl
                    options={VISIBILITY_OPTIONS}
                    value={exploreFilters.visibility}
                    onChange={v => onExploreFiltersChange({ ...exploreFilters, visibility: v })}
                  />
                  {authors.length > 0 && (
                    <Text style={styles.sectionLabelSpaced}>Auteur</Text>
                  )}
                  {authors.length === 0 && exploreFilters.visibility === 'all' && (
                    <Text style={styles.emptyHint}>Aucun message à proximité</Text>
                  )}
                </>
              )}

              {mode === 'mine' && (
                <>
                  <Text style={styles.sectionLabel}>Visibilité</Text>
                  <SegmentControl
                    options={VISIBILITY_OPTIONS}
                    value={mineFilters.visibility}
                    onChange={v => onMineFiltersChange({ ...mineFilters, visibility: v })}
                  />
                  <Text style={styles.sectionLabelSpaced}>Statut</Text>
                  <SegmentControl
                    options={READ_STATUS_OPTIONS}
                    value={mineFilters.readStatus}
                    onChange={v => onMineFiltersChange({ ...mineFilters, readStatus: v })}
                  />
                  {allRecipients.length > 0 && (
                    <Text style={styles.sectionLabelSpaced}>Destinataire</Text>
                  )}
                </>
              )}
            </View>

            {/* ── Person picker (list scrolls independently) ── */}
            {hasPeople && (
              <View style={styles.pickerWrapper}>
                {mode === 'explore' && (
                  <PersonSearchPicker
                    people={authors}
                    selectedIds={exploreFilters.authorIds}
                    onToggle={toggleAuthor}
                    onClearAll={() => onExploreFiltersChange({ ...exploreFilters, authorIds: [] })}
                    emptyLabel="Aucun message à proximité"
                  />
                )}
                {mode === 'mine' && (
                  <PersonSearchPicker
                    people={allRecipients}
                    selectedIds={mineFilters.recipientIds}
                    onToggle={toggleRecipient}
                    onClearAll={() => onMineFiltersChange({ ...mineFilters, recipientIds: [] })}
                  />
                )}
              </View>
            )}

      </View>
    </BottomSheet>
  );
}
