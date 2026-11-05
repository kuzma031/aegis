import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '@core/format';
import {
  completionRate,
  focusMsDelta,
  formatFocusDelta,
  getDistractionsBySite,
  getFocusByTask,
  getPreviousWeekPeriodStats,
  getTodayPeriodStats,
  getWeekCadence,
  getWeekPeriodStats,
  getYesterdayPeriodStats,
  startOfLocalWeek,
  type DayCadenceStat,
  type PeriodStats,
} from '@core/stats';
import { OptionSheet } from '@ui/components/OptionSheet';
import { ScreenHeader } from '@ui/components/ScreenHeader';
import { useAppState } from '@ui/hooks/useAppState';
import { useNow } from '@ui/hooks/useNow';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

function formatCompletion(stats: PeriodStats): string {
  const rate = completionRate(stats);
  if (rate == null) {
    return 'No sessions yet';
  }
  return `${Math.round(rate * 100)}% completion`;
}

function cadenceTone(
  day: DayCadenceStat,
  maxMs: number,
): 'warm' | 'warmer' | 'hot' | 'hotter' | 'today' | 'muted' {
  if (day.focusMs <= 0) {
    return 'muted';
  }
  if (day.isToday) {
    return 'today';
  }
  const ratio = maxMs > 0 ? day.focusMs / maxMs : 0;
  if (ratio >= 0.85) return 'hotter';
  if (ratio >= 0.65) return 'hot';
  if (ratio >= 0.4) return 'warmer';
  return 'warm';
}

function cadenceHeight(focusMs: number, maxMs: number): number {
  if (focusMs <= 0 || maxMs <= 0) {
    return 8;
  }
  return Math.max(12, Math.round((focusMs / maxMs) * 58));
}

const cadenceColors = {
  warm: '#fed7aa',
  warmer: '#fdba74',
  hot: '#fb923c',
  hotter: '#ea580c',
  today: '#b45309',
  muted: '#e7e5e4',
} as const;

export function StatsScreen() {
  const { state, loading, error: loadError } = useAppState();
  const now = useNow(false);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [statsContextId, setStatsContextId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const derived = useMemo(() => {
    if (!state) {
      return null;
    }
    const history =
      statsContextId == null
        ? state.history
        : state.history.filter((record) => record.contextId === statsContextId);

    const current =
      period === 'today'
        ? getTodayPeriodStats(history, now)
        : getWeekPeriodStats(history, now);
    const previous =
      period === 'today'
        ? getYesterdayPeriodStats(history, now)
        : getPreviousWeekPeriodStats(history, now);
    const rangeStart =
      period === 'today'
        ? new Date(now).setHours(0, 0, 0, 0)
        : startOfLocalWeek(now);
    const rangeEnd =
      period === 'today' ? rangeStart + 24 * 60 * 60_000 : rangeStart + 7 * 24 * 60 * 60_000;
    const sites = getDistractionsBySite(history, rangeStart, rangeEnd, 4);
    const byTask = getFocusByTask(history, rangeStart, rangeEnd);
    const cadence = getWeekCadence(history, now);
    const maxCadence = Math.max(...cadence.map((day) => day.focusMs), 1);

    return {
      current,
      previous,
      sites,
      byTask,
      cadence,
      maxCadence,
      siteTotal: sites.reduce((sum, item) => sum + item.count, 0),
    };
  }, [state, period, now, statsContextId]);

  if (loading || !state || !derived) {
    return <ScreenShell loading={loading} error={loadError}>{null}</ScreenShell>;
  }

  const selectedContext =
    statsContextId == null
      ? null
      : (state.contexts.find((context) => context.id === statsContextId) ?? null);
  const headerLabel = selectedContext?.name ?? 'All';
  const { current, previous, sites, byTask, cadence, maxCadence, siteTotal } = derived;
  const delta = focusMsDelta(current, previous);
  const topSiteCount = sites[0]?.count ?? 0;
  const assignedTaskCount = byTask.filter((item) => item.taskId != null).length;
  const taskCountLabel =
    assignedTaskCount > 0
      ? `${assignedTaskCount} task${assignedTaskCount === 1 ? '' : 's'}`
      : byTask.length > 0
        ? 'Unassigned only'
        : 'None yet';

  return (
    <ScreenShell loading={false} error={null}>
      <ScreenHeader
        eyebrow="Stats for"
        title={headerLabel}
        actionLabel="Switch"
        showChevron
        onAction={() => setPickerOpen(true)}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.periodToggle}>
          <Pressable
            style={[styles.periodBtn, period === 'today' ? styles.periodActive : null]}
            onPress={() => setPeriod('today')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'today' ? styles.periodTextActive : null,
              ]}
            >
              Today
            </Text>
          </Pressable>
          <Pressable
            style={[styles.periodBtn, period === 'week' ? styles.periodActive : null]}
            onPress={() => setPeriod('week')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'week' ? styles.periodTextActive : null,
              ]}
            >
              7 Days
            </Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <View style={[styles.metric, styles.metricAccent]}>
            <Text style={styles.metricLabel}>Focus time</Text>
            <Text style={styles.metricValue}>{formatDuration(current.focusMs)}</Text>
            <Text style={styles.metricDelta}>{formatFocusDelta(delta)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Sessions completed</Text>
            <Text style={styles.metricValue}>
              {current.sessionsCompleted}{' '}
              <Text style={styles.metricSuffix}>done</Text>
            </Text>
            <Text style={[styles.metricDelta, styles.metricAmber]}>
              {formatCompletion(current)}
            </Text>
          </View>
        </View>

        {period === 'week' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Weekly focus</Text>
            <View style={styles.cadence}>
              {cadence.map((day) => {
                const tone = cadenceTone(day, maxCadence);
                const height = cadenceHeight(day.focusMs, maxCadence);
                return (
                  <View
                    key={`${day.dayIndex}-${day.label}`}
                    style={styles.cadenceCol}
                    accessibilityLabel={`${day.label}: ${formatDuration(day.focusMs)}${day.isToday ? ' (today)' : ''}`}
                  >
                    <View
                      style={[
                        styles.cadenceBar,
                        {
                          height,
                          backgroundColor: cadenceColors[tone],
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.cadenceLabel,
                        day.isToday ? styles.cadenceLabelToday : null,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Peeks</Text>
            <Text style={styles.accent}>
              {current.peekCount > 0
                ? `${current.peekCount} taken`
                : current.peekStarts > 0
                  ? 'None completed'
                  : 'None yet'}
            </Text>
          </View>
          <StatRow label="Peeks started" value={String(current.peekStarts)} />
          <StatRow label="Peeks taken" value={String(current.peekCount)} />
          <StatRow label="Peek time unlocked" value={formatDuration(current.peekMs)} />
          <StatRow label="Peeks cancelled" value={String(current.peekAbandoned)} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Blocked visits</Text>
            <Text style={styles.accent}>
              {siteTotal > 0
                ? `${siteTotal} blocked visit${siteTotal === 1 ? '' : 's'}`
                : current.distractionOverrides > 0
                  ? `${current.distractionOverrides} blocked visit${current.distractionOverrides === 1 ? '' : 's'}`
                  : 'None yet'}
            </Text>
          </View>
          {sites.length === 0 ? (
            <Text style={styles.muted}>
              Blocked sites you open during focus will show up here.
            </Text>
          ) : (
            sites.map((item) => (
              <View key={item.site} style={styles.siteBlock}>
                <StatRow label={item.site} value={String(item.count)} />
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(8, Math.round((item.count / topSiteCount) * 100))}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Focus by task</Text>
            <Text style={styles.accent}>{taskCountLabel}</Text>
          </View>
          {byTask.length === 0 ? (
            <Text style={styles.muted}>
              Mark a task Working during focus to attribute time here.
            </Text>
          ) : (
            byTask.map((item, index) => (
              <StatRow
                key={item.taskId ?? `unassigned-${index}`}
                label={item.taskTitle}
                value={formatDuration(item.focusMs)}
              />
            ))
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Session rhythm</Text>
            <Text style={styles.mutedInline}>
              {current.pauseCount} pause{current.pauseCount === 1 ? '' : 's'}
            </Text>
          </View>
          <StatRow label="Break time" value={formatDuration(current.breakMs)} />
          <StatRow label="Breaks taken" value={String(current.breakCount)} />
        </View>
      </ScrollView>

      <OptionSheet
        visible={pickerOpen}
        title="Stats context"
        options={[
          { value: '__all__', label: 'All' },
          ...state.contexts.map((context) => ({
            value: context.id,
            label: context.name,
          })),
        ]}
        selected={statsContextId ?? '__all__'}
        onSelect={(value) => {
          setStatsContextId(value === '__all__' ? null : value);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </ScreenShell>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space[4],
    gap: space[3],
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.full,
    padding: 2,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  periodActive: {
    backgroundColor: colors.surface,
  },
  periodText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  periodTextActive: {
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    gap: space[3],
  },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    gap: 4,
  },
  metricAccent: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
  },
  metricSuffix: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  metricDelta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
  metricAmber: {
    color: colors.primary,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[2],
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  panelTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  accent: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  mutedInline: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  rowValue: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  siteBlock: {
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceInset,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  cadence: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    gap: 4,
  },
  cadenceCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  cadenceBar: {
    width: '70%',
    borderRadius: 4,
  },
  cadenceLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
  },
  cadenceLabelToday: {
    color: colors.primary,
  },
});
