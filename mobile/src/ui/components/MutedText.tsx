import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fonts } from '../theme';

export function MutedText({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.text, style]} />;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
});
