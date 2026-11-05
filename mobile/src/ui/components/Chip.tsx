import { StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

export function Chip({
  label,
  tone = 'soft',
}: {
  label: string;
  tone?: 'soft' | 'active';
}) {
  return (
    <Text style={[styles.chip, tone === 'active' ? styles.active : styles.soft]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    fontFamily: fonts.medium,
    fontSize: 11,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  soft: {
    backgroundColor: colors.surfaceInset,
    color: colors.textMuted,
  },
  active: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
});
