export type CompletionSoundId =
  | 'freesound-bell'
  | 'anvil-bell'
  | 'notify-bell'
  | 'opening-bell'
  | 'ring-bell';

export const DEFAULT_COMPLETION_SOUND: CompletionSoundId = 'freesound-bell';

export const COMPLETION_SOUNDS: ReadonlyArray<{
  id: CompletionSoundId;
  label: string;
  /** Path relative to extension root (public/). */
  file: string;
}> = [
  { id: 'freesound-bell', label: 'Classic bell', file: 'sounds/freesound-bell.mp3' },
  { id: 'anvil-bell', label: 'Anvil bell', file: 'sounds/anvil-bell.mp3' },
  { id: 'notify-bell', label: 'Notification bell', file: 'sounds/notify-bell.mp3' },
  { id: 'opening-bell', label: 'Opening bell', file: 'sounds/opening-bell.mp3' },
  { id: 'ring-bell', label: 'Ring bell', file: 'sounds/ring-bell.mp3' },
];

export const DEFAULT_FOCUS_COMPLETE_TITLE = 'Focus complete';
export const DEFAULT_FOCUS_COMPLETE_MESSAGE =
  'You focused for {time}. Enjoy your break.';
export const DEFAULT_CYCLE_FINISHED_TITLE = 'Session finished';
export const DEFAULT_CYCLE_FINISHED_MESSAGE =
  'Your focus cycle has ended. Nice work.';

const SOUND_IDS = new Set(COMPLETION_SOUNDS.map((sound) => sound.id));

export function isCompletionSoundId(value: unknown): value is CompletionSoundId {
  return typeof value === 'string' && SOUND_IDS.has(value as CompletionSoundId);
}

export function completionSoundFile(id: CompletionSoundId): string {
  const sound = COMPLETION_SOUNDS.find((item) => item.id === id);
  return sound?.file ?? COMPLETION_SOUNDS[0]!.file;
}

export function formatFocusTimeLabel(focusedMs: number): string {
  const safe = Math.max(0, focusedMs);
  if (safe < 60_000) {
    return `${Math.round(safe / 1000)}s`;
  }
  return `${Math.round(safe / 60_000)} min`;
}

/** Replace `{time}` in notification templates. */
export function formatNotificationTemplate(
  template: string,
  vars: { time: string },
): string {
  return template.replaceAll('{time}', vars.time);
}
