import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

export function TextField({
  label,
  value,
  onChangeText,
  onEndEditing,
  onSubmitEditing,
  placeholder,
  maxLength,
  autoFocus,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onEndEditing?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
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
