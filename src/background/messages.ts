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
  | { type: 'END_SESSION'; force?: boolean }
  | { type: 'EXTEND_FOCUS'; durationMinutes: number }
  | { type: 'START_BREAK' }
  | { type: 'CONTINUE_FOCUS' }
  | { type: 'START_ANOTHER' }
  | { type: 'DISMISS_COMPLETION' }
  | { type: 'RECORD_DISTRACTION'; site?: string }
  | { type: 'BEGIN_PEEK_WAIT'; site?: string }
  | { type: 'CLEAR_PEEK_WAIT' }
  | { type: 'ALLOW_PEEK'; site?: string; durationMinutes: number }
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
    case 'START_BREAK':
    case 'CONTINUE_FOCUS':
    case 'START_ANOTHER':
    case 'DISMISS_COMPLETION':
    case 'CHECK_EXPIRED':
      return true;
    case 'END_SESSION': {
      const cmd = value as { force?: unknown };
      return cmd.force === undefined || typeof cmd.force === 'boolean';
    }
    case 'EXTEND_FOCUS': {
      const cmd = value as { durationMinutes?: unknown };
      return typeof cmd.durationMinutes === 'number';
    }
    case 'RECORD_DISTRACTION':
    case 'BEGIN_PEEK_WAIT': {
      const cmd = value as { site?: unknown };
      return cmd.site === undefined || typeof cmd.site === 'string';
    }
    case 'CLEAR_PEEK_WAIT':
      return true;
    case 'ALLOW_PEEK': {
      const cmd = value as { site?: unknown; durationMinutes?: unknown };
      return (
        (cmd.site === undefined || typeof cmd.site === 'string') &&
        typeof cmd.durationMinutes === 'number'
      );
    }
    default:
      return false;
  }
}
