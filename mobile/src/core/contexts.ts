import { normalizeSite } from './domain';
import { getAppMode, type AppMode } from './env';
import { createId } from './ids';
import { validateBreakMinutes, validateFocusMinutes } from './session';
import { err, ok, type AppState, type Context, type Result } from './types';

const MAX_NAME_LENGTH = 40;
const DEFAULT_LONG_BREAK_AFTER_SESSIONS = 4;
const DEFAULT_LONG_BREAK_MINUTES = 15;
const MAX_LONG_BREAK_AFTER_SESSIONS = 99;

/** Daily goal disabled. */
export const DAILY_GOAL_OFF = 0;
/** Default daily focus goal (4 hours). */
export const DEFAULT_DAILY_GOAL_MINUTES = 240;
const MIN_DAILY_GOAL_MINUTES = 30;
const MAX_DAILY_GOAL_MINUTES = 480;
const DAILY_GOAL_STEP_MINUTES = 30;

export interface ContextDefaultsInput {
  focusMinutes: number;
  breakMinutes: number;
  autoRepeat: boolean;
  blockDuringBreak: boolean;
  strictLockControls: boolean;
  strictAllowPeek: boolean;
  strictAllowPeekOnBreak: boolean;
  strictEscalatePeek: boolean;
  longBreaksEnabled: boolean;
  longBreakAfterSessions: number;
  longBreakMinutes: number;
  dailyGoalMinutes: number;
}

export function formatDailyGoalLabel(minutes: number): string {
  if (minutes <= 0) {
    return 'Off';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} minutes`;
  }
  if (mins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const hourPart = hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hourPart} ${mins} minutes`;
}

export function dailyGoalOptions(): { value: number; label: string }[] {
  const options = [{ value: DAILY_GOAL_OFF, label: 'Off' }];
  for (
    let minutes = MIN_DAILY_GOAL_MINUTES;
    minutes <= MAX_DAILY_GOAL_MINUTES;
    minutes += DAILY_GOAL_STEP_MINUTES
  ) {
    options.push({ value: minutes, label: formatDailyGoalLabel(minutes) });
  }
  return options;
}

export function isValidDailyGoalMinutes(value: number): boolean {
  if (value === DAILY_GOAL_OFF) {
    return true;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return false;
  }
  return (
    value >= MIN_DAILY_GOAL_MINUTES &&
    value <= MAX_DAILY_GOAL_MINUTES &&
    value % DAILY_GOAL_STEP_MINUTES === 0
  );
}

function validateDailyGoalMinutes(value: number): Result<number> {
  if (!isValidDailyGoalMinutes(value)) {
    return err('Daily goal must be off or between 30 minutes and 8 hours in 30-minute steps');
  }
  return ok(value);
}

function validateName(raw: string, contexts: Context[], excludeId?: string): Result<string> {
  const name = raw.trim();
  if (!name) {
    return err('Name cannot be empty');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return err('Name must be 40 characters or fewer');
  }
  const taken = contexts.some(
    (context) =>
      context.id !== excludeId && context.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    return err('A context with that name already exists');
  }
  return ok(name);
}

function validateLongBreakAfterSessions(value: number): Result<number> {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return err('Long break interval must be a whole number');
  }
  if (value < 1 || value > MAX_LONG_BREAK_AFTER_SESSIONS) {
    return err(`Long break interval must be between 1 and ${MAX_LONG_BREAK_AFTER_SESSIONS}`);
  }
  return ok(value);
}

function replaceContext(state: AppState, updated: Context): AppState {
  return {
    ...state,
    contexts: state.contexts.map((context) =>
      context.id === updated.id ? updated : context,
    ),
  };
}

function defaultContextFields(
  name: string,
  id: string,
  now: number,
  extras?: Partial<Context>,
): Context {
  return {
    id,
    name,
    sites: [],
    defaultFocusMinutes: 25,
    defaultBreakMinutes: 5,
    autoRepeat: true,
    blockDuringBreak: true,
    strictLockControls: false,
    strictAllowPeek: true,
    strictAllowPeekOnBreak: true,
    strictEscalatePeek: true,
    longBreaksEnabled: false,
    longBreakAfterSessions: DEFAULT_LONG_BREAK_AFTER_SESSIONS,
    longBreakMinutes: DEFAULT_LONG_BREAK_MINUTES,
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    createdAt: now,
    updatedAt: now,
    ...extras,
  };
}

export function createContext(state: AppState, name: string, now: number): Result<AppState> {
  const nameResult = validateName(name, state.contexts);
  if (!nameResult.ok) {
    return nameResult;
  }

  const context = defaultContextFields(nameResult.value, createId(), now);

  return ok({
    ...state,
    contexts: [...state.contexts, context],
    settings: {
      ...state.settings,
      selectedContextId: state.settings.selectedContextId ?? context.id,
    },
  });
}

export function renameContext(
  state: AppState,
  contextId: string,
  name: string,
  now: number,
): Result<AppState> {
  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  const nameResult = validateName(name, state.contexts, contextId);
  if (!nameResult.ok) {
    return nameResult;
  }

  return ok(
    replaceContext(state, {
      ...context,
      name: nameResult.value,
      updatedAt: now,
    }),
  );
}

export function updateContextDefaults(
  state: AppState,
  contextId: string,
  defaults: ContextDefaultsInput,
  now: number,
  mode: AppMode = getAppMode(),
): Result<AppState> {
  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  const focusResult = validateFocusMinutes(defaults.focusMinutes, mode);
  if (!focusResult.ok) {
    return focusResult;
  }
  const breakResult = validateBreakMinutes(defaults.breakMinutes, mode);
  if (!breakResult.ok) {
    return breakResult;
  }
  const afterResult = validateLongBreakAfterSessions(defaults.longBreakAfterSessions);
  if (!afterResult.ok) {
    return afterResult;
  }
  const longBreakResult = validateBreakMinutes(defaults.longBreakMinutes, mode);
  if (!longBreakResult.ok) {
    return err(longBreakResult.error.replace(/^Break/, 'Long break'));
  }
  const goalResult = validateDailyGoalMinutes(defaults.dailyGoalMinutes);
  if (!goalResult.ok) {
    return goalResult;
  }

  const strictLockControls = defaults.strictLockControls === true;
  const strictAllowPeek = defaults.strictAllowPeek === true;
  const strictAllowPeekOnBreak = defaults.strictAllowPeekOnBreak === true;
  const strictEscalatePeek =
    (strictAllowPeek || strictAllowPeekOnBreak) &&
    defaults.strictEscalatePeek === true;

  if (
    context.defaultFocusMinutes === focusResult.value &&
    context.defaultBreakMinutes === breakResult.value &&
    context.autoRepeat === defaults.autoRepeat &&
    context.blockDuringBreak === defaults.blockDuringBreak &&
    context.strictLockControls === strictLockControls &&
    context.strictAllowPeek === strictAllowPeek &&
    context.strictAllowPeekOnBreak === strictAllowPeekOnBreak &&
    context.strictEscalatePeek === strictEscalatePeek &&
    context.longBreaksEnabled === defaults.longBreaksEnabled &&
    context.longBreakAfterSessions === afterResult.value &&
    context.longBreakMinutes === longBreakResult.value &&
    context.dailyGoalMinutes === goalResult.value
  ) {
    return ok(state);
  }

  return ok(
    replaceContext(state, {
      ...context,
      defaultFocusMinutes: focusResult.value,
      defaultBreakMinutes: breakResult.value,
      autoRepeat: defaults.autoRepeat,
      blockDuringBreak: defaults.blockDuringBreak,
      strictLockControls,
      strictAllowPeek,
      strictAllowPeekOnBreak,
      strictEscalatePeek,
      longBreaksEnabled: defaults.longBreaksEnabled,
      longBreakAfterSessions: afterResult.value,
      longBreakMinutes: longBreakResult.value,
      dailyGoalMinutes: goalResult.value,
      updatedAt: now,
    }),
  );
}

export function deleteContext(state: AppState, contextId: string): Result<AppState> {
  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  if (state.activeSession?.contextId === contextId) {
    return err('End the session first.');
  }

  const contexts = state.contexts.filter((item) => item.id !== contextId);
  let selectedContextId = state.settings.selectedContextId;
  if (selectedContextId === contextId) {
    selectedContextId = contexts[0]?.id ?? null;
  }

  return ok({
    ...state,
    contexts,
    settings: {
      ...state.settings,
      selectedContextId,
    },
  });
}

export function addSite(
  state: AppState,
  contextId: string,
  rawSite: string,
  now: number,
): Result<AppState> {
  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  const siteResult = normalizeSite(rawSite);
  if (!siteResult.ok) {
    return siteResult;
  }

  if (context.sites.includes(siteResult.value)) {
    return err('Site is already in this context');
  }

  return ok(
    replaceContext(state, {
      ...context,
      sites: [...context.sites, siteResult.value],
      updatedAt: now,
    }),
  );
}

export function removeSite(
  state: AppState,
  contextId: string,
  site: string,
  now: number,
): Result<AppState> {
  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  if (!context.sites.includes(site)) {
    return err('Site not found');
  }

  return ok(
    replaceContext(state, {
      ...context,
      sites: context.sites.filter((item) => item !== site),
      updatedAt: now,
    }),
  );
}

export function selectContext(state: AppState, contextId: string | null): Result<AppState> {
  if (contextId !== null && !state.contexts.some((item) => item.id === contextId)) {
    return err('Context not found');
  }

  return ok({
    ...state,
    settings: {
      ...state.settings,
      selectedContextId: contextId,
    },
  });
}
