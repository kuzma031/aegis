import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

export function NumberField({
  label,
  value,
  onChangeText,
  onCommit,
  placeholder,
  integer = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  integer?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onCommit}
        onSubmitEditing={onCommit}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
    flex: 1,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
