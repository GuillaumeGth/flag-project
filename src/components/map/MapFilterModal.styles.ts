import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme-redesign';

// Tailles spécifiques sans équivalent dans le scale du thème
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_MARGIN_TOP = 10;
const SEGMENT_PADDING_V = 7;
const SEGMENT_CONTAINER_PADDING = 3;
export default StyleSheet.create({
  sheet: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomWidth: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  sheetBlur: {
    flex: 1,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.surface.elevated,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: radius.xs,
    backgroundColor: colors.border.light,
    alignSelf: 'center',
    marginTop: HANDLE_MARGIN_TOP,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resetIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.primary.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  // Static filter controls — fixed height, no scroll
  staticContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  // Wrapper around the PersonSearchPicker — grows to fill remaining space
  pickerWrapper: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    minHeight: 0,
  },
  // PersonSearchPicker root — flex column filling pickerWrapper
  pickerRoot: {
    flex: 1,
    minHeight: 0,
  },
  // Card container for the scrollable list
  personListCard: {
    flex: 1,
    backgroundColor: colors.surface.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    minHeight: 0,
  },
  emptyHint: {
    color: colors.text.tertiary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // ── Segment controls (visibility / read status) ──────────────────────────
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surface.glassLight,
    borderRadius: radius.full,
    padding: SEGMENT_CONTAINER_PADDING,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  segmentActive: {
    paddingVertical: SEGMENT_PADDING_V,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentInactive: {
    paddingVertical: SEGMENT_PADDING_V,
    alignItems: 'center',
  },
  segmentLabelActive: {
    color: colors.text.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  segmentLabelInactive: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },

  // ── Selected pills / summary row ─────────────────────────────────────────
  selectedRow: {
    marginBottom: spacing.sm,
  },
  selectedRowContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectedPill: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  selectedPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pillAvatar: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillAvatarText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  pillLabel: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    maxWidth: 110,
  },
  // Compact summary when > MAX_VISIBLE_PILLS selected
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedAvatarItem: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.message.discovered,
    borderWidth: 1.5,
    borderColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarItemText: {
    color: colors.text.primary,
    fontSize: 9,
    fontWeight: '700',
  },
  selectedAvatarOverflow: {
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
  },
  selectedAvatarOverflowText: {
    color: colors.primary.violet,
    fontSize: 9,
    fontWeight: '700',
  },
  selectedSummaryLabel: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  selectedClearLabel: {
    color: colors.error,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },

  // ── Search input ──────────────────────────────────────────────────────────
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.sizes.sm,
    padding: 0,
    height: 20,
  },

  // ── Caption ───────────────────────────────────────────────────────────────
  searchCaption: {
    color: colors.text.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginLeft: 2,
  },

  // ── Person list rows ─────────────────────────────────────────────────────
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    minHeight: 44,
  },
  personRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  personRowActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
  },
  personAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.message.discovered,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
  },
  personAvatarText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  personAvatarTextActive: {
    color: colors.text.primary,
  },
  personName: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  personNameActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  personCount: {
    color: colors.text.tertiary,
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    minWidth: 16,
    textAlign: 'right',
  },
  personCheck: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCheckFill: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCheckEmpty: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },

});
