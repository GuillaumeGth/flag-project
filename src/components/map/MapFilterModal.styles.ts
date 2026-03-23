import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme-redesign';

// Tailles spécifiques sans équivalent dans le scale du thème
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_MARGIN_TOP = 10;
const CHIP_AVATAR_SIZE = 22;
const CHIP_AVATAR_FONT_SIZE = 10;
const CHIP_PADDING_V = 6;
const CHIP_PADDING_H = 10;
const CHIP_INNER_GAP = 6;
const CHIP_LABEL_MAX_WIDTH = 120;
const SEGMENT_PADDING_V = 7;
const SEGMENT_CONTAINER_PADDING = 3;
const SHEET_MAX_HEIGHT = '70%' as const;

export default StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    maxHeight: SHEET_MAX_HEIGHT,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomWidth: 0,
  },
  sheetBlur: {
    paddingBottom: spacing.xxxl,
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
  title: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
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
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_INNER_GAP,
    paddingVertical: CHIP_PADDING_V,
    paddingHorizontal: CHIP_PADDING_H,
  },
  chipInnerInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP_INNER_GAP,
    paddingVertical: CHIP_PADDING_V,
    paddingHorizontal: CHIP_PADDING_H,
    backgroundColor: colors.surface.glassLight,
  },
  chipAvatar: {
    width: CHIP_AVATAR_SIZE,
    height: CHIP_AVATAR_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.message.discovered,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    color: colors.text.primary,
    fontSize: CHIP_AVATAR_FONT_SIZE,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: colors.text.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    maxWidth: CHIP_LABEL_MAX_WIDTH,
  },
  chipLabelInactive: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    maxWidth: CHIP_LABEL_MAX_WIDTH,
  },
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: CHIP_INNER_GAP,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  resetLabel: {
    color: colors.primary.violet,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
});
