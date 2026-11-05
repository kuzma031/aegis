import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { normalizeSite } from '@core/domain';
import { formatClock } from '@core/format';
import {
  activePeekHosts,
  areSessionControlsLocked,
  getRemainingMs,
  isPeekAllowed,
  peekDurationOptions,
} from '@core/session';
import { sendCommand } from '@services/runtime';
import { Button } from '@ui/components/Button';
import { Chip } from '@ui/components/Chip';
import { ErrorText } from '@ui/components/ErrorText';
import { IconShield } from '@ui/components/icons';
import { OptionSheet } from '@ui/components/OptionSheet';
import { TimerRing } from '@ui/components/TimerRing';
import { useAppState } from '@ui/hooks/useAppState';
import { useNow } from '@ui/hooks/useNow';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

const BREATH_PHASE_MS = 4_000;

export function BlockedScreen() {
  const { host: hostParam } = useLocalSearchParams<{ host?: string }>();
  const router = useRouter();
  const { state, loading } = useAppState();
  const session = state?.activeSession ?? null;
  const peekWait = session?.run.peekWait ?? null;
  const peekAllowed = session ? isPeekAllowed(session) : false;
  const running = session?.status === 'running' || peekWait != null;
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [durationOpen, setDurationOpen] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'in' | 'out'>('in');
  const recordedDistraction = useRef(false);
  const breathScale = useRef(new Animated.Value(1)).current;

  const hostResult = hostParam ? normalizeSite(hostParam) : null;
  const host = hostResult?.ok ? hostResult.value : null;

  useEffect(() => {
    if (!state || state.activeSession) {
      return;
    }
    // Session gone: stay on finished panel (no browser redirect).
  }, [state]);

  useEffect(() => {
    if (recordedDistraction.current) {
      return;
    }
    if (!state?.activeSession || state.activeSession.phase !== 'focus') {
      return;
    }
    if (!host) {
      return;
    }
    recordedDistraction.current = true;
    void sendCommand({
      type: 'RECORD_DISTRACTION',
      site: host,
    });
  }, [state?.activeSession, host]);

  useEffect(() => {
    if (!session || !host) {
      return;
    }
    if (activePeekHosts(session, now).includes(host)) {
      void Linking.openURL(`https://${host}`).finally(() => {
        router.back();
      });
    }
  }, [session, host, now, router]);

  useEffect(() => {
    if (!host) {
      return;
    }
    if (peekWait?.host === host) {
      setOverlayOpen(true);
    }
  }, [peekWait?.host, host]);

  const durationOptions = session ? peekDurationOptions(session, now) : [];

  useEffect(() => {
    if (durationOptions.length === 0) {
      return;
    }
    if (!durationOptions.includes(durationMinutes)) {
      setDurationMinutes(durationOptions[0]!);
    }
  }, [durationOptions, durationMinutes]);

  useEffect(() => {
    if (!overlayOpen) {
      setBreathPhase('in');
      breathScale.setValue(1);
      return;
    }

    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) {
        return;
      }
      const animate = () => {
        setBreathPhase('in');
        loop = Animated.sequence([
          Animated.timing(breathScale, {
            toValue: 1,
            duration: BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(breathScale, {
            toValue: 0.92,
            duration: BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
        ]);
        setBreathPhase((phase) => (phase === 'in' ? 'out' : 'in'));
        loop.start(({ finished }) => {
          if (finished && !cancelled) {
            animate();
          }
        });
      };
      animate();
    });

    const id = setInterval(() => {
      setBreathPhase((phase) => (phase === 'in' ? 'out' : 'in'));
    }, BREATH_PHASE_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      loop?.stop();
    };
  }, [overlayOpen, breathScale]);

  async function handleEnd() {
    const result = await sendCommand({ type: 'END_SESSION' });
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleStartPeek() {
    if (!host) {
      return;
    }
    const result = await sendCommand({
      type: 'BEGIN_PEEK_WAIT',
      site: host,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setOverlayOpen(true);
  }

  async function handleCancelPeek() {
    const result = await sendCommand({ type: 'CLEAR_PEEK_WAIT' });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setOverlayOpen(false);
  }

  async function handleAllowPeek() {
    if (!host) {
      return;
    }
    const result = await sendCommand({
      type: 'ALLOW_PEEK',
      site: host,
      durationMinutes,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    try {
      await Linking.openURL(`https://${host}`);
    } catch (err: unknown) {
      console.error('[focus] open peeked site failed', err);
    }
    router.back();
  }

  if (loading || !state) {
    return <ScreenShell loading error={null}>{null}</ScreenShell>;
  }

  if (!session) {
    return (
      <ScreenShell loading={false} error={null}>
        <View style={styles.panel}>
          <Text style={styles.heading}>Session finished</Text>
          <Text style={styles.muted}>
            {host ? 'Your focus session has ended.' : 'Your focus session has ended.'}
          </Text>
          <Button variant="secondary" onPress={() => router.back()}>
            Close
          </Button>
        </View>
      </ScreenShell>
    );
  }

  const controlsLocked = areSessionControlsLocked(session);

  if (!host) {
    return (
      <ScreenShell loading={false} error={null}>
        <View style={styles.panel}>
          <Text style={styles.heading}>Session finished</Text>
          <Text style={styles.muted}>This page does not have a valid return URL.</Text>
          <View style={styles.row}>
            {!controlsLocked ? (
              <Button variant="ghost" onPress={() => void handleEnd()}>
                End session
              </Button>
            ) : null}
            <Button variant="secondary" onPress={() => router.back()}>
              Close
            </Button>
          </View>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </ScreenShell>
    );
  }

  const awaitingChoice = session.status === 'awaiting';
  const awaitingBreak = awaitingChoice && session.phase === 'break';
  const remainingMs = getRemainingMs(session, now);
  const remaining = formatClock(remainingMs);
  const progressPct = awaitingChoice
    ? 100
    : session.plannedMs > 0
      ? Math.min(
          100,
          Math.max(0, ((session.plannedMs - remainingMs) / session.plannedMs) * 100),
        )
      : 0;
  const timeLabel = awaitingChoice ? 'Done' : remaining;
  const chipLabel = awaitingBreak
    ? 'Break finished'
    : awaitingChoice
      ? 'Focus finished'
      : session.status === 'paused'
        ? 'Paused'
        : session.phase === 'break'
          ? 'On break'
          : 'Focus';

  const waitForHost = peekWait?.host === host ? peekWait : null;
  const showOverlay = overlayOpen && waitForHost != null && !awaitingChoice;
  const peekReadyMs = waitForHost ? Math.max(0, waitForHost.readyAt - now) : 0;
  const peekReady = waitForHost != null && peekReadyMs === 0;
  const showPeekButton =
    peekAllowed && !awaitingChoice && durationOptions.length > 0;

  return (
    <ScreenShell loading={false} error={null}>
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <IconShield size={18} color={colors.primary} />
          <Text style={styles.host}>{host}</Text>
        </View>
        <Text style={styles.contextName}>{session.contextName}</Text>
      </View>

      <View style={styles.main}>
        <View style={styles.medallion}>
          <View style={styles.medallionRing}>
            <IconShield size={36} color={colors.primary} />
          </View>
          <Text style={styles.medallionBadge}>Wardfocus active</Text>
        </View>

        <Text style={styles.title}>
          {awaitingBreak
            ? 'Break finished'
            : awaitingChoice
              ? 'Focus finished'
              : 'This site is blocked'}
        </Text>
        <Text style={styles.lede}>
          {awaitingBreak ? (
            <>
              Open Wardfocus to start another focus or end the session.{' '}
              <Text style={styles.strong}>{host}</Text> stays blocked until then.
            </>
          ) : awaitingChoice ? (
            <>
              Open Wardfocus to extend, start a break, or end.{' '}
              <Text style={styles.strong}>{host}</Text> stays blocked until then.
            </>
          ) : (
            <>
              <Text style={styles.strong}>{host}</Text> is blocked for{' '}
              <Text style={styles.strong}>{session.contextName}</Text> until this phase
              ends.
            </>
          )}
        </Text>

        <View style={styles.timerCard}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Chip label={chipLabel} />
          <Text style={styles.countdown}>{timeLabel}</Text>
          <Text style={styles.countdownLabel}>
            {awaitingChoice ? 'open Wardfocus to continue' : 'remaining'}
          </Text>
        </View>

        <View style={styles.actions}>
          {showPeekButton && !showOverlay ? (
            <Button variant="secondary" onPress={() => void handleStartPeek()}>
              Take a peek
            </Button>
          ) : null}
          <Button variant="primary" onPress={() => router.back()}>
            Close
          </Button>
          {!controlsLocked && !awaitingChoice ? (
            <Button variant="ghost" onPress={() => void handleEnd()}>
              End session
            </Button>
          ) : null}
        </View>

        {error && !showOverlay ? <ErrorText>{error}</ErrorText> : null}
      </View>

      <Modal
        visible={showOverlay}
        transparent
        animationType="fade"
        onRequestClose={() => void handleCancelPeek()}
      >
        <View style={styles.overlay}>
          <View style={styles.peekCard}>
            <Text style={styles.heading}>Peek at {host}</Text>
            <Animated.View style={{ transform: [{ scale: breathScale }] }}>
              <TimerRing size={160} progress={1}>
                <View />
              </TimerRing>
            </Animated.View>
            <Text style={styles.breathLabel}>
              {breathPhase === 'in' ? 'Breathe in' : 'Breathe out'}
            </Text>

            <Pressable
              style={[styles.selectBtn, !peekReady ? styles.selectDisabled : null]}
              disabled={!peekReady}
              onPress={() => setDurationOpen(true)}
            >
              <Text style={styles.selectLabel}>Peek for (minutes)</Text>
              <Text style={styles.selectValue}>{durationMinutes}</Text>
            </Pressable>

            <View style={styles.row}>
              <Button variant="ghost" onPress={() => void handleCancelPeek()}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  if (!peekReady) {
                    return;
                  }
                  void handleAllowPeek();
                }}
              >
                {peekReady ? 'Open site' : formatClock(peekReadyMs)}
              </Button>
            </View>
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
        </View>
      </Modal>

      <OptionSheet
        visible={durationOpen}
        title="Peek duration"
        options={durationOptions.map((minutes) => ({
          value: minutes,
          label: String(minutes),
        }))}
        selected={durationMinutes}
        onSelect={setDurationMinutes}
        onClose={() => setDurationOpen(false)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    justifyContent: 'center',
    padding: space[5],
    gap: space[3],
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  host: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  contextName: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  main: {
    flex: 1,
    padding: space[4],
    alignItems: 'center',
    gap: space[3],
  },
  medallion: {
    alignItems: 'center',
    gap: space[2],
    marginTop: space[4],
  },
  medallionRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionBadge: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  lede: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  strong: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  timerCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space[4],
    alignItems: 'center',
    gap: space[2],
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceInset,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  countdown: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.text,
  },
  countdownLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    width: '100%',
    gap: space[2],
  },
  heading: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    justifyContent: 'center',
    padding: space[4],
  },
  peekCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space[4],
    alignItems: 'center',
    gap: space[3],
  },
  breathLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  selectBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space[3],
    gap: 2,
  },
  selectDisabled: {
    opacity: 0.5,
  },
  selectLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  selectValue: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
  },
});
