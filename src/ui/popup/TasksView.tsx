import { useState } from 'react';
import { formatDuration } from '@core/format';
import { getDisplayedTaskFocusMs } from '@core/taskFocus';
import {
  createTask,
  deleteTask,
  renameTask,
  setTaskStatus,
  sortTasksForDisplay,
} from '@core/tasks';
import type { AppState, Task, TaskPresentation, TaskStatus } from '@core/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconEdit, IconPlus, IconShield, IconTrash } from '../components/icons';
import { useNow } from '../hooks/useNow';
import { getAppRepository } from '../services/repository';

const SECTIONS: { status: TaskStatus; title: string }[] = [
  { status: 'active', title: 'Working' },
  { status: 'todo', title: 'Todo' },
  { status: 'finished', title: 'Finished' },
];

function emptyTasksDescription(presentation: TaskPresentation): string {
  switch (presentation) {
    case 'extension':
      return 'Add a task, then mark it as working or done from this Tasks tab.';
    case 'sidepanel':
      return 'Add a task, then mark it as working or done here or from the side panel.';
    case 'hover':
      return 'Add a task, then mark it as working or done here or from the page-edge rail.';
  }
}

export function TasksView({ state }: { state: AppState }) {
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
    state.activeSession?.taskFocus != null &&
    state.activeSession.phase === 'focus' &&
    state.activeSession.status === 'running';
  const now = useNow(liveFocus);

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
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <h2 className="screen-title" style={{ margin: 0 }}>
            Tasks
          </h2>
        </div>
        <button
          type="button"
          className="switch-btn"
          onClick={() => {
            setCreating(true);
            setNewTitle('');
            setEditingId(null);
            setPendingDeleteId(null);
            setError(null);
          }}
        >
          <IconPlus style={{ width: 12, height: 12 }} />
          New
        </button>
      </header>

      <div className="screen-banner">
        <span>
          {openCount} open · {activeCount} working
        </span>
      </div>

      <div className="screen-body-scroll">
        {error ? <p className="error-text">{error}</p> : null}

        {creating ? (
          <form
            className="stack task-form"
            onSubmit={(event) => {
              event.preventDefault();
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
            <label className="field">
              <span className="muted">Task</span>
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={80}
                placeholder="What are you working on?"
                autoFocus
              />
            </label>
            <div className="row">
              <Button type="submit" variant="primary">
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {tasks.length === 0 && !creating ? (
          <EmptyState
            title="No tasks yet"
            description={emptyTasksDescription(state.settings.taskPresentation)}
            action={
              <Button
                variant="primary"
                onClick={() => {
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
          <div className="task-sections">
            {SECTIONS.map((section) => {
              const sectionTasks = tasks.filter((task) => task.status === section.status);
              return (
                <details
                  key={section.status}
                  className="task-section"
                  open={openSections[section.status]}
                  onToggle={(event) => {
                    const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                    setOpenSections((prev) => ({
                      ...prev,
                      [section.status]: nextOpen,
                    }));
                  }}
                >
                  <summary className="task-section-summary">
                    <span>{section.title}</span>
                    <span className="task-section-count">{sectionTasks.length}</span>
                  </summary>
                  {sectionTasks.length === 0 ? (
                    <p className="task-section-empty">No tasks</p>
                  ) : (
                    <ul className="task-list">
                      {sectionTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          focusMs={getDisplayedTaskFocusMs(task, state.activeSession, now)}
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
                      ))}
                    </ul>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </div>
    </>
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
    <li
      className={`task-card task-card--${task.status}${isEditing ? ' task-card--editing' : ''}${pendingDelete ? ' task-card--confirm-delete' : ''}`}
    >
      {isEditing ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit();
          }}
        >
          <label className="field">
            <span className="muted">Edit task</span>
            <input
              value={editTitle}
              onChange={(event) => onEditTitleChange(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </label>
          <div className="row">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </form>
      ) : pendingDelete ? (
        <div className="stack">
          <p className="task-card-title">Delete “{task.title}”?</p>
          <div className="row">
            <Button variant="primary" onClick={onConfirmDelete}>
              Delete
            </Button>
            <Button variant="ghost" onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="task-card-top">
            <div className="task-card-heading">
              <p className="task-card-title" style={{ margin: 0 }}>
                {task.title}
              </p>
              {focusMs > 0 ? (
                <span className="task-card-focus" title="Focus time on this task">
                  {formatDuration(focusMs)}
                </span>
              ) : null}
            </div>
            <div className="task-card-actions">
              <button
                type="button"
                className="edit-icon-btn"
                title="Edit task"
                aria-label={`Edit ${task.title}`}
                onClick={onStartEdit}
              >
                <IconEdit />
              </button>
              <button
                type="button"
                className="edit-icon-btn edit-icon-btn--danger"
                title="Delete task"
                aria-label={`Delete ${task.title}`}
                onClick={onRequestDelete}
              >
                <IconTrash />
              </button>
            </div>
          </div>
          <div className="task-status-actions">
            {task.status !== 'active' ? (
              <button
                type="button"
                className="task-status-btn task-status-btn--work"
                title="Mark as working on"
                onClick={() => onStatus('active')}
              >
                Work
              </button>
            ) : (
              <button
                type="button"
                className="task-status-btn"
                title="Pause working on this task"
                onClick={() => onStatus('todo')}
              >
                Pause
              </button>
            )}
            {task.status !== 'finished' ? (
              <button
                type="button"
                className="task-status-btn task-status-btn--done"
                title="Mark as done"
                onClick={() => onStatus('finished')}
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                className="task-status-btn"
                title="Reopen this task"
                onClick={() => onStatus('todo')}
              >
                Reopen
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
