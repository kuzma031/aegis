export type Command =
  | { type: 'START_SESSION'; contextId: string; durationMinutes: number }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'END_SESSION' }
  | { type: 'START_ANOTHER' }
  | { type: 'DISMISS_COMPLETION' };

export function isCommand(value: unknown): value is Command {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  switch (type) {
    case 'START_SESSION': {
      const cmd = value as { contextId?: unknown; durationMinutes?: unknown };
      return typeof cmd.contextId === 'string' && typeof cmd.durationMinutes === 'number';
    }
    case 'PAUSE_SESSION':
    case 'RESUME_SESSION':
    case 'END_SESSION':
    case 'START_ANOTHER':
    case 'DISMISS_COMPLETION':
      return true;
    default:
      return false;
  }
}
