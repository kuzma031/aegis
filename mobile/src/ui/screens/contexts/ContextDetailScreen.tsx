import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addSite,
  dailyGoalOptions,
  deleteContext,
  removeSite,
  renameContext,
  updateContextDefaults,
  type ContextDefaultsInput,
} from '@core/contexts';
import type { AppState } from '@core/types';
import { getAppRepository } from '@services/runtime';
import { Button } from '@ui/components/Button';
import { Chip } from '@ui/components/Chip';
import { EmptyState } from '@ui/components/EmptyState';
import { ErrorText } from '@ui/components/ErrorText';
import { IconPlus } from '@ui/components/icons';
import { NumberField } from '@ui/components/NumberField';
import { OptionSheet } from '@ui/components/OptionSheet';
import { ScreenHeader } from '@ui/components/ScreenHeader';
import { TextField } from '@ui/components/TextField';
import { Toggle } from '@ui/components/Toggle';
import { useAppState } from '@ui/hooks/useAppState';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

function parseMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function ContextDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, loading, error: loadError } = useAppState();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const context = state?.contexts.find((item) => item.id === id) ?? null;

  useEffect(() => {
    if (!loading && state && !context) {
      router.back();
    }
  }, [loading, state, context, router]);

  if (loading || !state) {
    return <ScreenShell loading={loading} error={loadError}>{null}</ScreenShell>;
  }

  if (!context) {
    return <ScreenShell loading error={null}>{null}</ScreenShell>;
  }

  async function applyUpdate(
    fn: (current: AppState) => { ok: true; value: AppState } | { ok: false; error: string },
  ) {
    let message = '';
    await getAppRepository().update((current) => {
      const result = fn(current);
      if (!result.ok) {
        message = result.error;
        return current;
      }
      return result.value;
    });
    if (message) {
      setError(message);
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <ContextDetailBody
      state={state}
      contextId={context.id}
      error={error}
      pendingDelete={pendingDelete}
      onBack={() => {
        setPendingDelete(false);
        setError(null);
        router.back();
      }}
      onError={setError}
      onRequestDelete={() => setPendingDelete(true)}
      onCancelDelete={() => setPendingDelete(false)}
      onConfirmDelete={async () => {
        const ok = await applyUpdate((current) => deleteContext(current, context.id));
        if (ok) {
          setPendingDelete(false);
          router.back();
        }
      }}
      onRename={async (name) => {
        await applyUpdate((current) =>
          renameContext(current, context.id, name, Date.now()),
        );
      }}
      onUpdateDefaults={async (defaults) => {
        return applyUpdate((current) =>
          updateContextDefaults(current, context.id, defaults, Date.now()),
        );
      }}
      onAddSite={async (raw) => {
        await applyUpdate((current) => addSite(current, context.id, raw, Date.now()));
      }}
      onRemoveSite={async (site) => {
        await applyUpdate((current) =>
          removeSite(current, context.id, site, Date.now()),
        );
      }}
      onPreviewBlocked={(host) =>
        router.push({ pathname: '/blocked', params: { host } })
      }
    />
  );
}

function ContextDetailBody({
  state,
  contextId,
  error,
  pendingDelete,
  onBack,
  onError,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onRename,
  onUpdateDefaults,
  onAddSite,
  onRemoveSite,
  onPreviewBlocked,
}: {
  state: AppState;
  contextId: string;
  error: string | null;
  pendingDelete: boolean;
  onBack: () => void;
  onError: (message: string | null) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRename: (name: string) => Promise<void>;
  onUpdateDefaults: (defaults: ContextDefaultsInput) => Promise<boolean>;
  onAddSite: (raw: string) => Promise<void>;
  onRemoveSite: (site: string) => Promise<void>;
  onPreviewBlocked: (host: string) => void;
}) {
  const latest = state.contexts.find((item) => item.id === contextId)!;
  const [name, setName] = useState(latest.name);
  const [focusMinutes, setFocusMinutes] = useState(String(latest.defaultFocusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(latest.defaultBreakMinutes));
  const [autoRepeat, setAutoRepeat] = useState(latest.autoRepeat);
  const [blockDuringBreak, setBlockDuringBreak] = useState(latest.blockDuringBreak);
  const [strictLockControls, setStrictLockControls] = useState(latest.strictLockControls);
  const [strictAllowPeek, setStrictAllowPeek] = useState(latest.strictAllowPeek);
  const [strictAllowPeekOnBreak, setStrictAllowPeekOnBreak] = useState(
    latest.strictAllowPeekOnBreak,
  );
  const [strictEscalatePeek, setStrictEscalatePeek] = useState(latest.strictEscalatePeek);
  const [longBreaksEnabled, setLongBreaksEnabled] = useState(latest.longBreaksEnabled);
  const [longBreakAfterSessions, setLongBreakAfterSessions] = useState(
    String(latest.longBreakAfterSessions),
  );
  const [longBreakMinutes, setLongBreakMinutes] = useState(String(latest.longBreakMinutes));
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(latest.dailyGoalMinutes);
  const [siteInput, setSiteInput] = useState('');
  const [goalOpen, setGoalOpen] = useState(false);
  const isActiveSessionContext = state.activeSession?.contextId === contextId;
  const isLongBreakError = error != null && /long break/i.test(error);
  const goalOptions = dailyGoalOptions();

  function revertDefaultsFields() {
    setFocusMinutes(String(latest.defaultFocusMinutes));
    setBreakMinutes(String(latest.defaultBreakMinutes));
    setAutoRepeat(latest.autoRepeat);
    setBlockDuringBreak(latest.blockDuringBreak);
    setStrictLockControls(latest.strictLockControls);
    setStrictAllowPeek(latest.strictAllowPeek);
    setStrictAllowPeekOnBreak(latest.strictAllowPeekOnBreak);
    setStrictEscalatePeek(latest.strictEscalatePeek);
    setLongBreaksEnabled(latest.longBreaksEnabled);
    setLongBreakAfterSessions(String(latest.longBreakAfterSessions));
    setLongBreakMinutes(String(latest.longBreakMinutes));
    setDailyGoalMinutes(latest.dailyGoalMinutes);
  }

  function buildDefaultsInput(
    nextAutoRepeat = autoRepeat,
    nextBlockDuringBreak = blockDuringBreak,
    nextLongBreaksEnabled = longBreaksEnabled,
    nextDailyGoalMinutes = dailyGoalMinutes,
    nextStrictLock = strictLockControls,
    nextStrictPeek = strictAllowPeek,
    nextStrictPeekOnBreak = strictAllowPeekOnBreak,
    nextStrictEscalate = strictEscalatePeek,
  ): ContextDefaultsInput | null {
    const focusValue = parseMinutesInput(focusMinutes);
    const breakValue = parseMinutesInput(breakMinutes);
    const afterValue = parseMinutesInput(longBreakAfterSessions);
    const longBreakValue = parseMinutesInput(longBreakMinutes);
    if (focusValue == null) {
      onError('Enter a valid focus duration in minutes');
      return null;
    }
    if (breakValue == null) {
      onError('Enter a valid break duration in minutes (0 to skip)');
      return null;
    }
    if (nextLongBreaksEnabled) {
      if (afterValue == null || !Number.isInteger(afterValue)) {
        onError('Enter how many focus sessions before a long break (whole number)');
        return null;
      }
      if (longBreakValue == null) {
        onError('Enter a valid long break duration in minutes');
        return null;
      }
    }
    const peekEnabled = nextStrictPeek || nextStrictPeekOnBreak;
    return {
      focusMinutes: focusValue,
      breakMinutes: breakValue,
      autoRepeat: nextAutoRepeat,
      blockDuringBreak: nextBlockDuringBreak,
      strictLockControls: nextStrictLock,
      strictAllowPeek: nextStrictPeek,
      strictAllowPeekOnBreak: nextStrictPeekOnBreak,
      strictEscalatePeek: peekEnabled && nextStrictEscalate,
      longBreaksEnabled: nextLongBreaksEnabled,
      longBreakAfterSessions:
        afterValue != null && Number.isInteger(afterValue)
          ? afterValue
          : latest.longBreakAfterSessions,
      longBreakMinutes:
        longBreakValue != null ? longBreakValue : latest.longBreakMinutes,
      dailyGoalMinutes: nextDailyGoalMinutes,
    };
  }

  async function saveDefaults(
    nextAutoRepeat = autoRepeat,
    nextBlockDuringBreak = blockDuringBreak,
    nextLongBreaksEnabled = longBreaksEnabled,
    nextDailyGoalMinutes = dailyGoalMinutes,
    nextStrictLock = strictLockControls,
    nextStrictPeek = strictAllowPeek,
    nextStrictPeekOnBreak = strictAllowPeekOnBreak,
    nextStrictEscalate = strictEscalatePeek,
  ) {
    const defaults = buildDefaultsInput(
      nextAutoRepeat,
      nextBlockDuringBreak,
      nextLongBreaksEnabled,
      nextDailyGoalMinutes,
      nextStrictLock,
      nextStrictPeek,
      nextStrictPeekOnBreak,
      nextStrictEscalate,
    );
    if (!defaults) {
      revertDefaultsFields();
      return;
    }
    if (
      defaults.focusMinutes === latest.defaultFocusMinutes &&
      defaults.breakMinutes === latest.defaultBreakMinutes &&
      defaults.autoRepeat === latest.autoRepeat &&
      defaults.blockDuringBreak === latest.blockDuringBreak &&
      defaults.strictLockControls === latest.strictLockControls &&
      defaults.strictAllowPeek === latest.strictAllowPeek &&
      defaults.strictAllowPeekOnBreak === latest.strictAllowPeekOnBreak &&
      defaults.strictEscalatePeek === latest.strictEscalatePeek &&
      defaults.longBreaksEnabled === latest.longBreaksEnabled &&
      defaults.longBreakAfterSessions === latest.longBreakAfterSessions &&
      defaults.longBreakMinutes === latest.longBreakMinutes &&
      defaults.dailyGoalMinutes === latest.dailyGoalMinutes
    ) {
      onError(null);
      return;
    }
    const saved = await onUpdateDefaults(defaults);
    if (!saved) {
      revertDefaultsFields();
    }
  }

  const selectedGoal =
    goalOptions.find((option) => option.value === dailyGoalMinutes)?.label ??
    'Off';

  return (
    <ScreenShell loading={false} error={null}>
      <ScreenHeader title="Edit Context" onBack={onBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Name and timing</Text>
          <TextField
            label="Context Name"
            value={name}
            onChangeText={setName}
            maxLength={40}
            onEndEditing={() => {
              if (name.trim() !== latest.name) {
                void onRename(name);
              }
            }}
          />

          <Text style={styles.subLabel}>Session Duration</Text>
          <View style={styles.durationRow}>
            <NumberField
              label="Focus (min)"
              value={focusMinutes}
              onChangeText={(value) => {
                setFocusMinutes(value);
                onError(null);
              }}
              onCommit={() => void saveDefaults()}
              placeholder="25"
            />
            <NumberField
              label="Break (min)"
              value={breakMinutes}
              onChangeText={(value) => {
                setBreakMinutes(value);
                onError(null);
              }}
              onCommit={() => void saveDefaults()}
              placeholder="5"
            />
          </View>

          <Pressable style={styles.selectBtn} onPress={() => setGoalOpen(true)}>
            <Text style={styles.selectLabel}>Daily goal</Text>
            <Text style={styles.selectValue}>{selectedGoal}</Text>
          </Pressable>

          {error && !isLongBreakError ? <ErrorText>{error}</ErrorText> : null}

          <Toggle
            label="Auto-start next session"
            hint="When enabled, a new focus session starts automatically after your break ends — until you stop the cycle."
            value={autoRepeat}
            onValueChange={(next) => {
              setAutoRepeat(next);
              void saveDefaults(next, blockDuringBreak, longBreaksEnabled);
            }}
          />
          <Toggle
            label="Keep sites blocked during breaks"
            hint="Keeping sites blocked on break helps you stay off those pages until the next focus."
            value={blockDuringBreak}
            onValueChange={(next) => {
              setBlockDuringBreak(next);
              void saveDefaults(autoRepeat, next, longBreaksEnabled);
            }}
          />
          <Toggle
            label="Long breaks"
            hint="After several focus sessions, take a longer break instead of the short one."
            value={longBreaksEnabled}
            onValueChange={(next) => {
              setLongBreaksEnabled(next);
              void saveDefaults(autoRepeat, blockDuringBreak, next);
            }}
          />
          {longBreaksEnabled ? (
            <>
              <View style={styles.durationRow}>
                <NumberField
                  label="After sessions"
                  value={longBreakAfterSessions}
                  onChangeText={(value) => {
                    setLongBreakAfterSessions(value);
                    onError(null);
                  }}
                  onCommit={() => void saveDefaults()}
                  placeholder="4"
                  integer
                />
                <NumberField
                  label="Long break (min)"
                  value={longBreakMinutes}
                  onChangeText={(value) => {
                    setLongBreakMinutes(value);
                    onError(null);
                  }}
                  onCommit={() => void saveDefaults()}
                  placeholder="15"
                />
              </View>
              {isLongBreakError ? <ErrorText>{error!}</ErrorText> : null}
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Strict mode</Text>
          <Text style={styles.muted}>
            Optional locks for when willpower runs low. Copied onto the session when you
            start.
          </Text>
          <Toggle
            label="Lock pause and end during session"
            hint="Hide pause and end while a timer is running. You can still choose at phase boundaries."
            value={strictLockControls}
            onValueChange={(next) => {
              setStrictLockControls(next);
              void saveDefaults(
                autoRepeat,
                blockDuringBreak,
                longBreaksEnabled,
                dailyGoalMinutes,
                next,
              );
            }}
          />
          <Toggle
            label="Allow a peek during focus"
            hint="On the blocked page, wait then open that site for a chosen duration during focus."
            value={strictAllowPeek}
            onValueChange={(next) => {
              setStrictAllowPeek(next);
              const escalate =
                next || strictAllowPeekOnBreak ? strictEscalatePeek : false;
              if (!next && !strictAllowPeekOnBreak) {
                setStrictEscalatePeek(false);
              }
              void saveDefaults(
                autoRepeat,
                blockDuringBreak,
                longBreaksEnabled,
                dailyGoalMinutes,
                strictLockControls,
                next,
                strictAllowPeekOnBreak,
                escalate,
              );
            }}
          />
          <Toggle
            label="Allow a peek during breaks"
            hint="Same peek flow during breaks when sites stay blocked."
            value={strictAllowPeekOnBreak}
            onValueChange={(next) => {
              setStrictAllowPeekOnBreak(next);
              const escalate = strictAllowPeek || next ? strictEscalatePeek : false;
              if (!strictAllowPeek && !next) {
                setStrictEscalatePeek(false);
              }
              void saveDefaults(
                autoRepeat,
                blockDuringBreak,
                longBreaksEnabled,
                dailyGoalMinutes,
                strictLockControls,
                strictAllowPeek,
                next,
                escalate,
              );
            }}
          />
          <Toggle
            label="Longer wait after each peek"
            hint="Each peek makes the next wait longer: 10s, then 1m, 5m, 15m, 30m."
            value={strictEscalatePeek}
            disabled={!strictAllowPeek && !strictAllowPeekOnBreak}
            onValueChange={(next) => {
              setStrictEscalatePeek(next);
              void saveDefaults(
                autoRepeat,
                blockDuringBreak,
                longBreaksEnabled,
                dailyGoalMinutes,
                strictLockControls,
                strictAllowPeek,
                strictAllowPeekOnBreak,
                next,
              );
            }}
          />

          <View style={styles.sitesHeader}>
            <Text style={styles.heading}>Blocked Websites</Text>
            <Chip
              label={`${latest.sites.length} ${latest.sites.length === 1 ? 'site' : 'sites'}`}
            />
          </View>
          <Text style={styles.muted}>
            These domains are blocked during a session that uses this context.
          </Text>

          <View style={styles.addRow}>
            <TextField
              label="Add site"
              value={siteInput}
              onChangeText={(value) => {
                setSiteInput(value);
                onError(null);
              }}
              placeholder="e.g., twitter.com, reddit.com..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={() => {
                void (async () => {
                  await onAddSite(siteInput);
                  setSiteInput('');
                })();
              }}
            />
            <Button
              variant="primary"
              style={{ alignSelf: 'flex-end' }}
              onPress={() => {
                void (async () => {
                  await onAddSite(siteInput);
                  setSiteInput('');
                })();
              }}
            >
              <IconPlus size={14} color={colors.onPrimary} />
              <Text style={styles.addLabel}>Add</Text>
            </Button>
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {latest.sites.length === 0 ? (
            <EmptyState
              title="No sites blocked"
              description="Add a domain above to block it during focus sessions."
            />
          ) : (
            latest.sites.map((site) => (
              <View key={site} style={styles.siteRow}>
                <Pressable
                  style={styles.siteLeft}
                  onPress={() => onPreviewBlocked(site)}
                >
                  <View style={styles.siteGlyph}>
                    <Text style={styles.siteGlyphText}>
                      {site.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.siteName}>{site}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Remove ${site}`}
                  onPress={() => void onRemoveSite(site)}
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))
          )}

          <View style={styles.danger}>
            <Text style={styles.dangerTitle}>Delete Context</Text>
            <Text style={styles.muted}>
              Permanently remove this preset and its {latest.sites.length} blocked domain
              rules.
            </Text>
            {pendingDelete ? (
              <View style={styles.row}>
                <Button
                  variant="primary"
                  onPress={onConfirmDelete}
                  disabled={isActiveSessionContext}
                >
                  Delete
                </Button>
                <Button variant="ghost" onPress={onCancelDelete}>
                  Cancel
                </Button>
              </View>
            ) : (
              <Button
                variant="ghost"
                disabled={isActiveSessionContext}
                onPress={onRequestDelete}
              >
                Delete This Context
              </Button>
            )}
            {isActiveSessionContext ? (
              <Text style={styles.muted}>End the session first.</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={goalOpen}
        title="Daily goal"
        options={goalOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        selected={dailyGoalMinutes}
        onSelect={(next) => {
          setDailyGoalMinutes(next);
          onError(null);
          void saveDefaults(autoRepeat, blockDuringBreak, longBreaksEnabled, next);
        }}
        onClose={() => setGoalOpen(false)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space[4],
    gap: space[3],
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: space[2],
  },
  subLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  durationRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    gap: 2,
  },
  selectLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  selectValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  sitesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space[2],
  },
  heading: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
  },
  addRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'flex-end',
  },
  addLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  siteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
  },
  siteGlyph: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteGlyphText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  siteName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  removeBtn: {
    padding: 8,
  },
  removeText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  danger: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    gap: space[2],
  },
  dangerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.danger,
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
});
