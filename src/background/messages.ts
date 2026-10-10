export type Command =
  | {
      type: 'START_SESSION';
      contextId: string;
      durationMinutes: number;
      breakMinutes: number;
      repeat: boolean;
    }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'END_SESSION' }
  | { type: 'START_ANOTHER' }
  | { type: 'DISMISS_COMPLETION' }
  | { type: 'RECORD_DISTRACTION'; site?: string }
  | { type: 'CHECK_EXPIRED' };

export function isCommand(value: unknown): value is Command {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  switch (type) {
    case 'START_SESSION': {
      const cmd = value as {
        contextId?: unknown;
        durationMinutes?: unknown;
        breakMinutes?: unknown;
        repeat?: unknown;
      };
      return (
        typeof cmd.contextId === 'string' &&
        typeof cmd.durationMinutes === 'number' &&
        typeof cmd.breakMinutes === 'number' &&
        typeof cmd.repeat === 'boolean'
      );
    }
    case 'PAUSE_SESSION':
    case 'RESUME_SESSION':
    case 'END_SESSION':
    case 'START_ANOTHER':
    case 'DISMISS_COMPLETION':
    case 'CHECK_EXPIRED':
      return true;
    case 'RECORD_DISTRACTION': {
      const cmd = value as { site?: unknown };
      return cmd.site === undefined || typeof cmd.site === 'string';
    }
    default:
      return false;
  }
}
