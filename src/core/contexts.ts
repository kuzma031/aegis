import { normalizeSite } from './domain';
import { createId } from './ids';
import { err, ok, type AppState, type Context, type Result } from './types';

const MAX_NAME_LENGTH = 40;

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

function replaceContext(state: AppState, updated: Context): AppState {
  return {
    ...state,
    contexts: state.contexts.map((context) =>
      context.id === updated.id ? updated : context,
    ),
  };
}

export function createContext(state: AppState, name: string, now: number): Result<AppState> {
  const nameResult = validateName(name, state.contexts);
  if (!nameResult.ok) {
    return nameResult;
  }

  const context: Context = {
    id: createId(),
    name: nameResult.value,
    sites: [],
    createdAt: now,
    updatedAt: now,
  };

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
