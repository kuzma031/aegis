import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { IconChevronDown, IconShield } from './icons';

export function ScreenHeader({
  eyebrow,
  title,
  badge,
  onBack,
  actionLabel,
  onAction,
  actionIcon,
  showChevron = false,
}: {
  eyebrow?: string;
  title: string;
  badge?: ReactNode;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  showChevron?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={styles.iconBtn}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.iconBox}>
            <IconShield size={18} color={colors.primary} />
          </View>
        )}
        <View style={styles.meta}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {badge}
          </View>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable style={styles.switchBtn} onPress={onAction}>
          {actionIcon}
          <Text style={styles.switchLabel}>{actionLabel}</Text>
          {showChevron ? <IconChevronDown size={12} color={colors.textMuted} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHeader,
    backgroundColor: colors.bg,
    gap: space[2],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    fontFamily: fonts.medium,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.text,
    flexShrink: 1,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[2],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  switchLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
});
