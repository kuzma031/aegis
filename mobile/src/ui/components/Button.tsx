import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, controlMin, fonts, radius, space } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'secondary',
  large = false,
  disabled = false,
  onPress,
  children,
  style,
}: {
  variant?: ButtonVariant;
  large?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : null,
        variant === 'primary' ? styles.primary : null,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'ghost' ? styles.ghost : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnPrimary : null,
            variant === 'ghost' ? styles.labelGhost : null,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: controlMin,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  large: {
    minHeight: 48,
    paddingVertical: space[3],
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  labelOnPrimary: {
    color: colors.onPrimary,
  },
  labelGhost: {
    color: colors.textMuted,
  },
});
