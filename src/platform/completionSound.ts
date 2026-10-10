import {
  completionSoundFile,
  DEFAULT_COMPLETION_SOUND,
  isCompletionSoundId,
  type CompletionSoundId,
} from '@core/completionFeedback';
import { ensureOffscreenReady } from './offscreenAudio';

const PLAY_MESSAGE = 'PLAY_COMPLETION_SOUND' as const;

export async function playCompletionSound(
  soundId: CompletionSoundId | string | null | undefined,
): Promise<void> {
  const id = isCompletionSoundId(soundId) ? soundId : DEFAULT_COMPLETION_SOUND;
  const url = chrome.runtime.getURL(completionSoundFile(id));
  await ensureOffscreenReady();
  await chrome.runtime.sendMessage({ type: PLAY_MESSAGE, url });
}
