import { ambientTrackFile, ambientTrackForSession, type AmbientTrackId } from '@core/ambientAudio';
import type { AppState } from '@core/types';
import { ensureOffscreenReady, hasOffscreenDocument } from './offscreenAudio';

const START_MESSAGE = 'START_AMBIENT' as const;
const STOP_MESSAGE = 'STOP_AMBIENT' as const;

let chain: Promise<void> = Promise.resolve();

export function syncAmbientAudio(state: AppState): Promise<void> {
  const track = ambientTrackForSession(
    state.settings.ambientEnabled,
    state.settings.ambientTrackId,
    state.activeSession?.status,
  );
  const run = chain.then(() => applyAmbient(track));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function applyAmbient(track: AmbientTrackId | null): Promise<void> {
  if (track == null) {
    if (!(await hasOffscreenDocument())) {
      return;
    }
    await chrome.runtime.sendMessage({ type: STOP_MESSAGE });
    return;
  }

  const url = chrome.runtime.getURL(ambientTrackFile(track));
  await ensureOffscreenReady();
  await chrome.runtime.sendMessage({ type: START_MESSAGE, url });
}
