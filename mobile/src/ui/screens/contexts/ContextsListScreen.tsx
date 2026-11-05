import { useState } from 'react';
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
import { createContext } from '@core/contexts';
import type { AppState, Context } from '@core/types';
import { getAppRepository } from '@services/runtime';
import { Button } from '@ui/components/Button';
import { Chip } from '@ui/components/Chip';
import { EmptyState } from '@ui/components/EmptyState';
import { ErrorText } from '@ui/components/ErrorText';
import { IconClock, IconEdit, IconInfo, IconPlus, IconShield } from '@ui/components/icons';
import { ScreenHeader } from '@ui/components/ScreenHeader';
import { TextField } from '@ui/components/TextField';
import { useAppState } from '@ui/hooks/useAppState';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

function formatDefaultTiming(context: Context): string {
  return `${context.defaultFocusMinutes}m / ${context.defaultBreakMinutes}m`;
}

export function ContextsListScreen() {
  const { state, loading, error: loadError } = useAppState();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (loading || !state) {
    return <ScreenShell loading={loading} error={loadError}>{null}</ScreenShell>;
  }

  const selected =
    state.contexts.find((context) => context.id === state.settings.selectedContextId) ??
    state.contexts[0] ??
    null;
  const activeSession = state.activeSession;
  const totalSites = selected?.sites.length ?? 0;

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

  async function handleSelectContext(contextId: string) {
    try {
      await getAppRepository().update((current) => {
        if (!current.contexts.some((context) => context.id === contextId)) {
          return current;
        }
        return {
          ...current,
          settings: { ...current.settings, selectedContextId: contextId },
        };
      });
      setError(null);
    } catch (err: unknown) {
      console.error('[focus] selectContext failed', err);
      setError('Could not change context');
    }
  }

  return (
    <ScreenShell loading={false} error={null}>
      <ScreenHeader
        title={selected?.name ?? 'Contexts'}
        badge={
          activeSession && selected && activeSession.contextId === selected.id ? (
            <Chip label="Active" tone="active" />
          ) : null
        }
        actionLabel="New"
        actionIcon={<IconPlus size={12} color={colors.text} />}
        onAction={() => {
          setCreating(true);
          setNewName('');
          setError(null);
        }}
      />
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Blocked sites in selected context</Text>
        <Text style={styles.bannerText}>
          {totalSites} {totalSites === 1 ? 'site' : 'sites'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {creating ? (
            <View style={styles.form}>
              <TextField
                label="Name"
                value={newName}
                onChangeText={setNewName}
                maxLength={40}
                autoFocus
              />
              <View style={styles.row}>
                <Button
                  variant="primary"
                  onPress={() => {
                    void (async () => {
                      const ok = await applyUpdate((current) =>
                        createContext(current, newName, Date.now()),
                      );
                      if (ok) {
                        setCreating(false);
                        setNewName('');
                      }
                    })();
                  }}
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setCreating(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </View>
            </View>
          ) : null}

          {state.contexts.length === 0 ? (
            <EmptyState
              title="No contexts yet"
              description="Create one to start blocking sites during focus."
            />
          ) : (
            state.contexts.map((context) => {
              const isSelected = context.id === selected?.id;
              const isSessionActive = activeSession?.contextId === context.id;
              return (
                <View
                  key={context.id}
                  style={[styles.card, isSelected ? styles.cardActive : null]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.identity}>
                      <View style={styles.dot} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{context.name}</Text>
                          {isSessionActive ? (
                            <Chip label="In session" tone="active" />
                          ) : isSelected ? (
                            <Chip label="Selected" />
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      {!isSelected ? (
                        <Pressable
                          style={styles.miniAction}
                          onPress={() => void handleSelectContext(context.id)}
                        >
                          <Text style={styles.miniActionText}>Select</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityLabel={`Edit ${context.name}`}
                        style={styles.iconBtn}
                        onPress={() => router.push(`/contexts/${context.id}`)}
                      >
                        <IconEdit size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.footer}>
                    <View style={styles.metaItem}>
                      <IconShield size={14} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        <Text style={styles.metaStrong}>{context.sites.length}</Text>{' '}
                        {context.sites.length === 1 ? 'site' : 'sites'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <IconClock size={14} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        <Text style={styles.metaStrong}>
                          {formatDefaultTiming(context)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {selected ? (
            <View style={styles.notice}>
              <IconInfo size={14} color={colors.primary} />
              <Text style={styles.noticeText}>
                Sites listed in <Text style={styles.metaStrong}>{selected.name}</Text> are
                blocked during a session that uses this context.
              </Text>
            </View>
          ) : null}

          {error ? <ErrorText>{error}</ErrorText> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: colors.banner,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bannerText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  body: {
    padding: space[4],
    gap: space[3],
  },
  form: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[3],
  },
  cardActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[2],
  },
  identity: {
    flexDirection: 'row',
    gap: space[2],
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniActionText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
  iconBtn: {
    padding: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaStrong: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  notice: {
    flexDirection: 'row',
    gap: space[2],
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.lg,
    padding: space[3],
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
