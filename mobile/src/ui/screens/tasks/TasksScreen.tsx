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
import { formatDuration } from '@core/format';
import { getDisplayedTaskFocusMs } from '@core/taskFocus';
import {
  createTask,
  deleteTask,
  renameTask,
  setTaskStatus,
  sortTasksForDisplay,
} from '@core/tasks';
import type { AppState, Task, TaskStatus } from '@core/types';
import { getAppRepository } from '@services/runtime';
import { Button } from '@ui/components/Button';
import { EmptyState } from '@ui/components/EmptyState';
import { ErrorText } from '@ui/components/ErrorText';
import { IconEdit, IconPlus, IconTrash } from '@ui/components/icons';
import { ScreenHeader } from '@ui/components/ScreenHeader';
import { TextField } from '@ui/components/TextField';
import { useAppState } from '@ui/hooks/useAppState';
import { useNow } from '@ui/hooks/useNow';
import { colors, fonts, radius, space } from '@ui/theme';
import { ScreenShell } from '../ScreenShell';

const SECTIONS: { status: TaskStatus; title: string }[] = [
  { status: 'active', title: 'Working' },
  { status: 'todo', title: 'Todo' },
  { status: 'finished', title: 'Finished' },
];

export function TasksScreen() {
  const { state, loading, error: loadError } = useAppState();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<TaskStatus, boolean>>({
    active: true,
    todo: true,
    finished: false,
  });

  const liveFocus =
    state?.activeSession?.taskFocus != null &&
    state.activeSession.phase === 'focus' &&
    state.activeSession.status === 'running';
  const now = useNow(Boolean(liveFocus));

  if (loading || !state) {
    return <ScreenShell loading={loading} error={loadError}>{null}</ScreenShell>;
  }

  const tasks = sortTasksForDisplay(state.tasks);
  const activeCount = state.tasks.filter((task) => task.status === 'active').length;
  const openCount = state.tasks.filter((task) => task.status !== 'finished').length;

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

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setPendingDeleteId(null);
    setCreating(false);
    setError(null);
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    await applyUpdate((current) => setTaskStatus(current, taskId, status, Date.now()));
  }

  return (
    <ScreenShell loading={false} error={null}>
      <ScreenHeader
        title="Tasks"
        actionLabel="New"
        actionIcon={<IconPlus size={12} color={colors.text} />}
        onAction={() => {
          setCreating(true);
          setNewTitle('');
          setEditingId(null);
          setPendingDeleteId(null);
          setError(null);
        }}
      />
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {openCount} open · {activeCount} working
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
          {error ? <ErrorText>{error}</ErrorText> : null}

          {creating ? (
            <View style={styles.form}>
              <TextField
                label="Task"
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={80}
                placeholder="What are you working on?"
                autoFocus
              />
              <View style={styles.row}>
                <Button
                  variant="primary"
                  onPress={() => {
                    void (async () => {
                      const ok = await applyUpdate((current) =>
                        createTask(current, newTitle, Date.now()),
                      );
                      if (ok) {
                        setCreating(false);
                        setNewTitle('');
                      }
                    })();
                  }}
                >
                  Add
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

          {tasks.length === 0 && !creating ? (
            <EmptyState
              title="No tasks yet"
              description="Add a task, then mark it as working or done from this Tasks tab."
              action={
                <Button
                  variant="primary"
                  onPress={() => {
                    setCreating(true);
                    setNewTitle('');
                    setError(null);
                  }}
                >
                  Add task
                </Button>
              }
            />
          ) : (
            SECTIONS.map((section) => {
              const sectionTasks = tasks.filter(
                (task) => task.status === section.status,
              );
              const open = openSections[section.status];
              return (
                <View key={section.status} style={styles.section}>
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [section.status]: !prev[section.status],
                      }))
                    }
                  >
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionCount}>{sectionTasks.length}</Text>
                    <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                  </Pressable>
                  {open ? (
                    sectionTasks.length === 0 ? (
                      <Text style={styles.empty}>No tasks</Text>
                    ) : (
                      sectionTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          focusMs={getDisplayedTaskFocusMs(
                            task,
                            state.activeSession,
                            now,
                          )}
                          isEditing={editingId === task.id}
                          pendingDelete={pendingDeleteId === task.id}
                          editTitle={editTitle}
                          onEditTitleChange={setEditTitle}
                          onStartEdit={() => startEdit(task)}
                          onCancelEdit={() => {
                            setEditingId(null);
                            setError(null);
                          }}
                          onSaveEdit={() => {
                            void (async () => {
                              const ok = await applyUpdate((current) =>
                                renameTask(current, task.id, editTitle, Date.now()),
                              );
                              if (ok) {
                                setEditingId(null);
                              }
                            })();
                          }}
                          onRequestDelete={() => {
                            setPendingDeleteId(task.id);
                            setEditingId(null);
                            setError(null);
                          }}
                          onCancelDelete={() => setPendingDeleteId(null)}
                          onConfirmDelete={() => {
                            void (async () => {
                              const ok = await applyUpdate((current) =>
                                deleteTask(current, task.id),
                              );
                              if (ok) {
                                setPendingDeleteId(null);
                              }
                            })();
                          }}
                          onStatus={(status) => void updateStatus(task.id, status)}
                        />
                      ))
                    )
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

function TaskCard({
  task,
  focusMs,
  isEditing,
  pendingDelete,
  editTitle,
  onEditTitleChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onStatus,
}: {
  task: Task;
  focusMs: number;
  isEditing: boolean;
  pendingDelete: boolean;
  editTitle: string;
  onEditTitleChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onStatus: (status: TaskStatus) => void;
}) {
  return (
    <View style={styles.card}>
      {isEditing ? (
        <View style={styles.form}>
          <TextField
            label="Edit task"
            value={editTitle}
            onChangeText={onEditTitleChange}
            maxLength={80}
            autoFocus
          />
          <View style={styles.row}>
            <Button variant="primary" onPress={onSaveEdit}>
              Save
            </Button>
            <Button variant="ghost" onPress={onCancelEdit}>
              Cancel
            </Button>
          </View>
        </View>
      ) : pendingDelete ? (
        <View style={styles.form}>
          <Text style={styles.cardTitle}>Delete “{task.title}”?</Text>
          <View style={styles.row}>
            <Button variant="primary" onPress={onConfirmDelete}>
              Delete
            </Button>
            <Button variant="ghost" onPress={onCancelDelete}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              {focusMs > 0 ? (
                <Text style={styles.focus}>{formatDuration(focusMs)}</Text>
              ) : null}
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={onStartEdit} accessibilityLabel={`Edit ${task.title}`}>
                <IconEdit size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={onRequestDelete}
                accessibilityLabel={`Delete ${task.title}`}
              >
                <IconTrash size={16} color={colors.danger} />
              </Pressable>
            </View>
          </View>
          <View style={styles.statusRow}>
            {task.status !== 'active' ? (
              <Pressable
                style={[styles.statusBtn, styles.workBtn]}
                onPress={() => onStatus('active')}
              >
                <Text style={styles.workText}>Work</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.statusBtn} onPress={() => onStatus('todo')}>
                <Text style={styles.statusText}>Pause</Text>
              </Pressable>
            )}
            {task.status !== 'finished' ? (
              <Pressable
                style={[styles.statusBtn, styles.doneBtn]}
                onPress={() => onStatus('finished')}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.statusBtn} onPress={() => onStatus('todo')}>
                <Text style={styles.statusText}>Reopen</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
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
  section: {
    gap: space[2],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  sectionCount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  chevron: {
    color: colors.textMuted,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    paddingLeft: space[1],
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[2],
  },
  cardTop: {
    flexDirection: 'row',
    gap: space[2],
  },
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  focus: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: space[3],
  },
  statusRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  statusBtn: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workBtn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  doneBtn: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
  workText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  doneText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
});
