import { StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme-redesign';

const ACTION_BUTTON_SIZE = 36;

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerSpacer: {},
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
    marginTop: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 10,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  followButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary.violet,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary.violet,
  },
  followButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  followButtonTextActive: {
    color: colors.primary.violet,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bellButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  notifModalCard: {
    width: '100%',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.medium,
  },
  notifModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  notifModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  notifRowInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  notifRowLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  notifDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
});
