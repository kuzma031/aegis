import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, space } from '../theme';

const CIRCUMFERENCE = 2 * Math.PI * 66;

export function TimerRing({
  progress,
  children,
  size = 190,
}: {
  progress: number;
  children: ReactNode;
  size?: number;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 160 160">
        <G rotation={-90} origin="80, 80">
          <Circle
            cx="80"
            cy="80"
            r="66"
            stroke={colors.ringTrack}
            strokeWidth="6"
            fill="none"
          />
          <Circle
            cx="80"
            cy="80"
            r="66"
            stroke={colors.primary}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
});
