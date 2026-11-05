import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: space[5],
    paddingHorizontal: space[4],
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  action: {
    marginTop: space[2],
  },
});
