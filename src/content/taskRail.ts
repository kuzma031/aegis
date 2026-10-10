import { formatDuration } from '@core/format';
import { getDisplayedTaskFocusMs, isTaskFocusAccruing } from '@core/taskFocus';
import { setTaskStatus, sortTasksForDisplay } from '@core/tasks';
import type { AppState, Task, TaskStatus } from '@core/types';
import { migrate } from '@platform/migrations';
import { STORAGE_KEY } from '@platform/storage';
import { TASK_RAIL_STYLES } from './taskRailStyles';

const HOST_TAG = 'aegis-v0x-dock';

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'active':
      return 'Working';
    case 'finished':
      return 'Finished';
    default:
      return 'Todo';
  }
}

async function loadState(): Promise<AppState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return migrate(stored[STORAGE_KEY], Date.now());
}

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite(fn: (state: AppState) => AppState): Promise<AppState> {
  const run = writeQueue.then(async () => {
    const current = await loadState();
    const next = fn(current);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  });
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function ensureHost(): HTMLElement {
  const existing = document.querySelector(HOST_TAG);
  if (existing instanceof HTMLElement) {
    return existing;
  }
  const host = document.createElement(HOST_TAG);
  host.style.cssText =
    'all:initial;display:block!important;position:fixed!important;top:50%!important;right:0!important;transform:translateY(-50%)!important;z-index:2147483646!important;pointer-events:none;';
  document.documentElement.appendChild(host);
  return host;
}

function renderTaskNode(
  task: Task,
  state: AppState,
  now: number,
  onStatus: (taskId: string, status: TaskStatus) => void,
): HTMLLIElement {
  const node = document.createElement('li');
  node.className = `aegis-v0x-node aegis-v0x-node--${task.status}`;

  const signal = document.createElement('span');
  signal.className = 'aegis-v0x-signal';
  signal.textContent = statusLabel(task.status);

  const codex = document.createElement('span');
  codex.className = 'aegis-v0x-codex';
  codex.textContent = task.title;

  const focusMs = getDisplayedTaskFocusMs(task, state.activeSession, now);
  if (focusMs > 0) {
    const focus = document.createElement('span');
    focus.className = 'aegis-v0x-focus';
    focus.textContent = formatDuration(focusMs);
    node.append(signal, codex, focus);
  } else {
    node.append(signal, codex);
  }

  const actuators = document.createElement('div');
  actuators.className = 'aegis-v0x-actuators';

  const addActuator = (label: string, status: TaskStatus, variant?: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = variant
      ? `aegis-v0x-actuator ${variant}`
      : 'aegis-v0x-actuator';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onStatus(task.id, status);
    });
    actuators.appendChild(button);
  };

  if (task.status !== 'active') {
    addActuator('Work', 'active', 'aegis-v0x-actuator--engage');
  } else {
    addActuator('Pause', 'todo');
  }

  if (task.status !== 'finished') {
    addActuator('Done', 'finished', 'aegis-v0x-actuator--complete');
  } else {
    addActuator('Reopen', 'todo');
  }

  node.append(actuators);
  return node;
}

function renderRail(shadow: ShadowRoot, state: AppState, now = Date.now()): void {
  const tasks = sortTasksForDisplay(state.tasks).filter(
    (task) => task.status === 'active' || task.status === 'todo',
  );
  let rail = shadow.querySelector('.aegis-v0x-rail');

  if (tasks.length === 0) {
    rail?.remove();
    return;
  }

  if (!(rail instanceof HTMLElement)) {
    rail = document.createElement('div');
    rail.className = 'aegis-v0x-rail';
    rail.setAttribute('tabindex', '0');
    rail.setAttribute('aria-label', 'Aegis tasks');
    shadow.appendChild(rail);
  }

  rail.replaceChildren();

  const spine = document.createElement('div');
  spine.className = 'aegis-v0x-spine';
  spine.textContent = 'Tasks';

  const hull = document.createElement('div');
  hull.className = 'aegis-v0x-hull';

  const beacon = document.createElement('p');
  beacon.className = 'aegis-v0x-beacon';
  beacon.textContent = 'Aegis tasks';

  const swarm = document.createElement('ul');
  swarm.className = 'aegis-v0x-swarm';

  const onStatus = (taskId: string, status: TaskStatus) => {
    void enqueueWrite((current) => {
      const result = setTaskStatus(current, taskId, status, Date.now());
      return result.ok ? result.value : current;
    }).catch((error: unknown) => {
      console.error('[aegis] task rail update failed', error);
    });
  };

  for (const task of tasks) {
    swarm.appendChild(renderTaskNode(task, state, now, onStatus));
  }

  hull.append(beacon, swarm);
  rail.append(spine, hull);
}

function removeHost(): void {
  document.querySelector(HOST_TAG)?.remove();
}

function mount(): void {
  if (window !== window.top) {
    return;
  }

  let latestState: AppState | null = null;
  let tickId: number | null = null;
  let shadow: ShadowRoot | null = null;

  const stopTick = () => {
    if (tickId != null) {
      window.clearInterval(tickId);
      tickId = null;
    }
  };

  const ensureShadow = (): ShadowRoot => {
    const host = ensureHost();
    const root =
      host.shadowRoot ??
      host.attachShadow({
        mode: 'open',
      });
    if (!root.querySelector('style[data-aegis-v0x]')) {
      const style = document.createElement('style');
      style.dataset.aegisV0x = '1';
      style.textContent = TASK_RAIL_STYLES;
      root.appendChild(style);
    }
    shadow = root;
    return root;
  };

  const syncTick = (state: AppState) => {
    const shouldTick =
      state.settings.taskPresentation === 'hover' &&
      isTaskFocusAccruing(state.activeSession) &&
      state.activeSession?.taskFocus != null;
    if (shouldTick && tickId == null) {
      tickId = window.setInterval(() => {
        if (latestState && shadow && latestState.settings.taskPresentation === 'hover') {
          renderRail(shadow, latestState, Date.now());
        }
      }, 1000);
    } else if (!shouldTick) {
      stopTick();
    }
  };

  const refresh = () => {
    void loadState()
      .then((state) => {
        latestState = state;
        if (state.settings.taskPresentation !== 'hover') {
          stopTick();
          removeHost();
          shadow = null;
          return;
        }
        const root = ensureShadow();
        renderRail(root, state);
        syncTick(state);
      })
      .catch((error: unknown) => {
        console.error('[aegis] task rail load failed', error);
      });
  };

  refresh();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    refresh();
  });
}

mount();
