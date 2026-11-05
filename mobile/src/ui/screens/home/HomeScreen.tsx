import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DAILY_GOAL_OFF } from '@core/contexts';
import { formatClock, formatDuration, formatMinutesPhrase } from '@core/format';
import {
  areSessionControlsLocked,
  getPendingBreak,
  getRemainingMs,
} from '@core/session';
import { getTodayPeriodStats } from '@core/stats';
import type { AppState, SessionSummary, VoidResult } from '@core/types';
import { getAppRepository, sendCommand } from '@services/runtime';
import { Button } from '@ui/components/Button';
import { Chip } from '@ui/components/Chip';
import { EmptyState } from '@ui/components/EmptyState';
import { ErrorText } from '@ui/components/ErrorText';
import {
  IconClock,
  IconEdit,
  IconPause,
  IconPlay,
} from '@ui/components/icons';
import { NumberField } from '@ui/components/NumberField';
import { OptionSheet } from '@ui/components/OptionSheet';
import { ScreenHeader } from '@ui/components/ScreenHeader';
import { TimerRing } from '@ui/components/TimerRing';
import { useAppState } from '@ui/hooks/useAppState';
import { useNow } from '@ui/hooks/useNow';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

function parseMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function HomeScreen() {
  const { state, loading, error: loadError } = useAppState();
  const router = useRouter();
  const running = state?.activeSession?.status === 'running';
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const [extendMinutes, setExtendMinutes] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (loading || !state) {
    return <ScreenShell loading={loading} error={loadError} children={null} />;
  }

  const selectedContext =
    state.contexts.find((context) => context.id === state.settings.selectedContextId) ??
    state.contexts[0] ??
    null;

  const focusMinutes = selectedContext?.defaultFocusMinutes ?? 25;
  const breakMinutes = selectedContext?.defaultBreakMinutes ?? 5;
  const autoRepeat = selectedContext?.autoRepeat ?? false;

  async function runCommand(resultPromise: Promise<VoidResult>) {
    const result = await resultPromise;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
  }

  async function handleStart() {
    if (!selectedContext) return;
    await runCommand(
      sendCommand({
        type: 'START_SESSION',
        contextId: selectedContext.id,
        durationMinutes: focusMinutes,
        breakMinutes,
        repeat: autoRepeat,
      }),
    );
  }

  async function handleSelectContext(contextId: string) {
    try {
      await getAppRepository().update((current) => {
        const next = current.contexts.some((context) => context.id === contextId)
          ? {
              ...current,
              settings: { ...current.settings, selectedContextId: contextId },
            }
          : current;
        return next;
      });
      setPickerOpen(false);
      setError(null);
    } catch (err: unknown) {
      console.error('[focus] selectContext failed', err);
      setError('Could not change context');
    }
  }

  let body: ReactNode;

  if (state.contexts.length === 0) {
    body = (
      <EmptyState
        title="No contexts yet"
        description="Create a focus context to choose which sites to block."
        action={
          <Button variant="primary" onPress={() => router.push('/contexts')}>
            Create your first context
          </Button>
        }
      />
    );
  } else if (!state.activeSession && state.lastSessionSummary) {
    body = (
      <SessionEndedView
        summary={state.lastSessionSummary}
        error={error}
        onDone={() => void runCommand(sendCommand({ type: 'DISMISS_COMPLETION' }))}
      />
    );
  } else if (
    state.activeSession?.status === 'awaiting' &&
    state.activeSession.phase === 'focus'
  ) {
    const session = state.activeSession;
    const pendingBreak = getPendingBreak(session);
    const inputValue =
      extendMinutes == null ? String(session.focusMinutes) : extendMinutes;
    body = (
      <AwaitingFocusView
        state={state}
        error={error}
        extendMinutes={inputValue}
        hasBreak={pendingBreak.minutes > 0}
        breakLabel={pendingBreak.isLongBreak ? 'Start long break' : 'Start break'}
        onExtendMinutesChange={(value) => setExtendMinutes(value)}
        onExtend={() => {
          const minutes = parseMinutesInput(inputValue);
          if (minutes == null) {
            setError('Enter a valid focus length');
            return;
          }
          void runCommand(
            sendCommand({ type: 'EXTEND_FOCUS', durationMinutes: minutes }),
          );
        }}
        onStartBreak={() => void runCommand(sendCommand({ type: 'START_BREAK' }))}
        onEnd={() => void runCommand(sendCommand({ type: 'END_SESSION' }))}
      />
    );
  } else if (
    state.activeSession?.status === 'awaiting' &&
    state.activeSession.phase === 'break'
  ) {
    body = (
      <AwaitingBreakView
        state={state}
        error={error}
        onContinueFocus={() =>
          void runCommand(sendCommand({ type: 'CONTINUE_FOCUS' }))
        }
        onEnd={() => void runCommand(sendCommand({ type: 'END_SESSION' }))}
      />
    );
  } else if (state.activeSession) {
    body = (
      <RunningHome
        state={state}
        now={now}
        error={error}
        onPauseResume={() => {
          const isPaused = state.activeSession?.status === 'paused';
          void runCommand(
            sendCommand({ type: isPaused ? 'RESUME_SESSION' : 'PAUSE_SESSION' }),
          );
        }}
        onEnd={() => void runCommand(sendCommand({ type: 'END_SESSION' }))}
        onCheckExpired={() => void runCommand(sendCommand({ type: 'CHECK_EXPIRED' }))}
      />
    );
  } else {
    const todayHistory =
      selectedContext == null
        ? state.history
        : state.history.filter((record) => record.contextId === selectedContext.id);
    const today = getTodayPeriodStats(todayHistory, now);
    const dailyGoalMinutes = selectedContext?.dailyGoalMinutes ?? DAILY_GOAL_OFF;
    const previewClock = formatClock(Math.max(0, focusMinutes) * 60_000);

    body = (
      <>
        <ScreenHeader
          eyebrow="Context"
          title={selectedContext?.name ?? 'Choose context'}
          actionLabel="Switch"
          showChevron
          onAction={() => setPickerOpen(true)}
        />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.timerWrap}>
            <TimerRing progress={1}>
              <Text style={styles.timerValue}>{previewClock}</Text>
              <Text style={styles.timerCaption}>
                {formatMinutesPhrase(focusMinutes)} focus
                {breakMinutes > 0
                  ? ` · ${formatMinutesPhrase(breakMinutes)} break`
                  : ''}
              </Text>
            </TimerRing>
            {selectedContext ? (
              <Pressable
                style={styles.editLink}
                onPress={() => router.push(`/contexts/${selectedContext.id}`)}
              >
                <IconEdit size={12} color={colors.textMuted} />
                <Text style={styles.editLinkText}>Edit context</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button variant="primary" large onPress={() => void handleStart()}>
              <IconPlay size={16} color={colors.onPrimary} />
              <Text style={styles.primaryLabel}>Start focus</Text>
            </Button>

            <View style={styles.ribbon}>
              <View style={styles.ribbonLeft}>
                <IconClock size={14} color={colors.textMuted} />
                <Text style={styles.ribbonLabel}>Today</Text>
              </View>
              <Text style={styles.ribbonValue}>
                <Text style={styles.ribbonStrong}>{formatDuration(today.focusMs)}</Text>
                {dailyGoalMinutes > DAILY_GOAL_OFF
                  ? ` of ${formatDuration(dailyGoalMinutes * 60_000)}`
                  : ''}
              </Text>
            </View>

            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
        </ScrollView>

        <OptionSheet
          visible={pickerOpen}
          title="Contexts"
          options={state.contexts.map((context) => ({
            value: context.id,
            label: context.name,
          }))}
          selected={selectedContext?.id}
          onSelect={(value) => void handleSelectContext(value)}
          onClose={() => setPickerOpen(false)}
        />
      </>
    );
  }

  return (
    <ScreenShell loading={false} error={null}>
      {body}
    </ScreenShell>
  );
}

function AwaitingFocusView({
  state,
  error,
  extendMinutes,
  hasBreak,
  breakLabel,
  onExtendMinutesChange,
  onExtend,
  onStartBreak,
  onEnd,
}: {
  state: AppState;
  error: string | null;
  extendMinutes: string;
  hasBreak: boolean;
  breakLabel: string;
  onExtendMinutesChange: (value: string) => void;
  onExtend: () => void;
  onStartBreak: () => void;
  onEnd: () => void;
}) {
  const session = state.activeSession!;

  return (
    <>
      <ScreenHeader
        eyebrow="Focus finished"
        title={session.contextName}
        badge={<Chip label="Choice" />}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.completeTitle}>Are you in flow?</Text>
          <Text style={styles.completeSubtitle}>
            You finished{' '}
            <Text style={styles.strong}>{formatMinutesPhrase(session.focusMinutes)}</Text>{' '}
            of focus with{' '}
            <Text style={styles.strong}>{session.distractionOverrides}</Text> distraction{' '}
            {session.distractionOverrides === 1 ? 'override' : 'overrides'}. Extend, take
            a break, or end the session.
          </Text>

          <View style={styles.extendRow}>
            <NumberField
              label="Extend for (min)"
              value={extendMinutes}
              onChangeText={onExtendMinutesChange}
            />
            <Button variant="primary" onPress={onExtend} style={{ alignSelf: 'flex-end' }}>
              Extend
            </Button>
          </View>

          <View style={styles.controls}>
            {hasBreak ? (
              <Button variant="secondary" onPress={onStartBreak}>
                {breakLabel}
              </Button>
            ) : null}
            <Button variant="ghost" onPress={onEnd}>
              End session
            </Button>
          </View>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function AwaitingBreakView({
  state,
  error,
  onContinueFocus,
  onEnd,
}: {
  state: AppState;
  error: string | null;
  onContinueFocus: () => void;
  onEnd: () => void;
}) {
  const session = state.activeSession!;
  const breakLabel = session.isLongBreak ? 'Long break' : 'Break';

  return (
    <>
      <ScreenHeader
        eyebrow={`${breakLabel} finished`}
        title={session.contextName}
        badge={<Chip label="Choice" />}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.completeTitle}>Ready for another focus?</Text>
        <Text style={styles.completeSubtitle}>
          This run has <Text style={styles.strong}>{session.run.focusCount}</Text> focus{' '}
          {session.run.focusCount === 1 ? 'session' : 'sessions'} (
          <Text style={styles.strong}>{formatDuration(session.run.focusMs)}</Text>). Start
          another{' '}
          <Text style={styles.strong}>{formatMinutesPhrase(session.focusMinutes)}</Text>{' '}
          focus, or end and see your recap.
        </Text>
        <View style={styles.controls}>
          <Button variant="primary" onPress={onContinueFocus}>
            <IconPlay size={14} color={colors.onPrimary} />
            <Text style={styles.primaryLabel}>Start focus</Text>
          </Button>
          <Button variant="secondary" onPress={onEnd}>
            End session
          </Button>
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
    </>
  );
}

function SessionEndedView({
  summary,
  error,
  onDone,
}: {
  summary: SessionSummary;
  error: string | null;
  onDone: () => void;
}) {
  const totalMs = summary.focusMs + summary.breakMs;

  return (
    <>
      <ScreenHeader eyebrow="Session complete" title={summary.contextName} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.completeTitle}>Session recap</Text>
        <Text style={styles.completeSubtitle}>Focus and break time from this run.</Text>

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{summary.focusCount}</Text>
            <Text style={styles.statLabel}>Focus sessions</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{summary.breakCount}</Text>
            <Text style={styles.statLabel}>Breaks</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Focus time" value={formatDuration(summary.focusMs)} />
          <Row label="Break time" value={formatDuration(summary.breakMs)} />
          <Row label="Total time" value={formatDuration(totalMs)} strong />
        </View>

        {summary.tasks.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tasks</Text>
            {summary.tasks.map((task) => (
              <Row
                key={task.taskId}
                label={task.taskTitle}
                value={formatDuration(task.focusMs)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Blocked site hits" value={String(summary.distractionOverrides)} />
          <Row label="Peeks taken" value={String(summary.peekCount)} />
          <Row label="Peek time" value={formatDuration(summary.peekMs)} />
          <Row label="Pauses" value={String(summary.pauseCount)} />
        </View>

        <Button variant="primary" large onPress={onDone}>
          Back to Home
        </Button>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
    </>
  );
}

function RunningHome({
  state,
  now,
  error,
  onPauseResume,
  onEnd,
  onCheckExpired,
}: {
  state: AppState;
  now: number;
  error: string | null;
  onPauseResume: () => void;
  onEnd: () => void;
  onCheckExpired: () => void;
}) {
  const session = state.activeSession!;
  const remainingMs = getRemainingMs(session, now);
  const remaining = formatClock(remainingMs);
  const isPaused = session.status === 'paused';
  const isBreak = session.phase === 'break';
  const controlsLocked = areSessionControlsLocked(session);
  const progress =
    session.plannedMs > 0
      ? Math.min(1, Math.max(0, remainingMs / session.plannedMs))
      : 0;
  const plannedLabel =
    session.plannedMs < 60_000
      ? `${Math.round(session.plannedMs / 1000)}s`
      : `${Math.round(session.plannedMs / 60_000)} min`;
  const context =
    state.contexts.find((item) => item.id === session.contextId) ?? null;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const checkedExpiryKey = useRef<string | null>(null);

  useEffect(() => {
    if (session.status !== 'running' || remainingMs > 0) {
      return;
    }
    const key = `${session.id}:${session.phase}`;
    if (checkedExpiryKey.current === key) {
      return;
    }
    checkedExpiryKey.current = key;
    onCheckExpired();
  }, [session.status, session.id, session.phase, remainingMs, onCheckExpired]);

  return (
    <>
      <ScreenHeader
        eyebrow="Context"
        title={session.contextName}
        badge={
          <Chip
            label={
              isBreak
                ? session.isLongBreak
                  ? 'Long break'
                  : 'Break'
                : 'Focus'
            }
          />
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.timerWrap}>
          <TimerRing progress={progress}>
            <Text style={styles.timerValue}>{remaining}</Text>
            <Text style={styles.timerRemaining}>
              {isBreak
                ? isPaused
                  ? session.isLongBreak
                    ? 'Long break paused'
                    : 'Break paused'
                  : session.isLongBreak
                    ? 'Long break remaining'
                    : 'Break remaining'
                : `${isPaused ? 'Paused · ' : ''}${plannedLabel} focus`}
            </Text>
          </TimerRing>
          {isBreak ? (
            <Text style={styles.pill}>
              {context?.blockDuringBreak
                ? 'Sites stay blocked during this break.'
                : 'Sites are unblocked during this break.'}
            </Text>
          ) : isPaused ? (
            <Text style={styles.pill}>Blocking stays on until you resume.</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {controlsLocked ? (
            <Text style={styles.locked}>
              Pause and end are locked until this phase finishes.
            </Text>
          ) : confirmEnd ? (
            <View style={styles.endConfirm}>
              <Text style={styles.endConfirmText}>
                {isBreak
                  ? 'End break and stop the cycle?'
                  : 'End this focus session?'}
              </Text>
              <View style={styles.controls}>
                <Button variant="ghost" onPress={() => setConfirmEnd(false)}>
                  Keep going
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setConfirmEnd(false);
                    onEnd();
                  }}
                >
                  Yes, end session
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.controls}>
              <Button variant="secondary" onPress={onPauseResume}>
                {isPaused ? (
                  <>
                    <IconPlay size={14} color={colors.text} />
                    <Text style={styles.secondaryLabel}>Resume</Text>
                  </>
                ) : (
                  <>
                    <IconPause size={14} color={colors.text} />
                    <Text style={styles.secondaryLabel}>Pause</Text>
                  </>
                )}
              </Button>
              <Button variant="ghost" onPress={() => setConfirmEnd(true)}>
                End Session
              </Button>
            </View>
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </ScrollView>
    </>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong ? styles.strong : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space[4],
    gap: space[4],
  },
  timerWrap: {
    alignItems: 'center',
    gap: space[3],
  },
  timerValue: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.text,
  },
  timerCaption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  timerRemaining: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLinkText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    gap: space[3],
  },
  primaryLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  secondaryLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  ribbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ribbonLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  ribbonValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  ribbonStrong: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  completeTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
  },
  completeSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  strong: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  extendRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'flex-end',
  },
  controls: {
    flexDirection: 'row',
    gap: space[2],
    flexWrap: 'wrap',
  },
  statGrid: {
    flexDirection: 'row',
    gap: space[3],
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[2],
  },
  cardLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  rowValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  pill: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    textAlign: 'center',
  },
  locked: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  endConfirm: {
    gap: space[3],
  },
  endConfirmText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
});
