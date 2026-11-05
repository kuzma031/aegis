import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';

export function Toggle({
  label,
  value,
  onValueChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  disabled: {
    opacity: 0.5,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
