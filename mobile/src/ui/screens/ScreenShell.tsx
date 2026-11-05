import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '../theme';

export function ScreenShell({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string | null;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.shell} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading Wardfocus…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.shell} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    padding: space[4],
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dangerText,
    textAlign: 'center',
  },
});
