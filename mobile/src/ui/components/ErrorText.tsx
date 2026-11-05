import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function ErrorText({ children }: { children: string }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.dangerText,
  },
});
