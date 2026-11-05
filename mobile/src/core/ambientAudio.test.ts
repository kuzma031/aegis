import { describe, expect, it } from 'vitest';
import { ambientTrackForSession } from './ambientAudio';

describe('ambientTrackForSession', () => {
  it('stays silent when audio is off', () => {
    expect(ambientTrackForSession(false, 'cafe', 'running')).toBeNull();
  });

  it('stays silent without a running session', () => {
    expect(ambientTrackForSession(true, 'cafe', null)).toBeNull();
    expect(ambientTrackForSession(true, 'cafe', 'paused')).toBeNull();
  });

  it('loops the selected track while a session is running', () => {
    expect(ambientTrackForSession(true, 'lofi', 'running')).toBe('lofi');
  });

  it('falls back to brown noise for an unknown track id', () => {
    expect(ambientTrackForSession(true, 'nope', 'running')).toBe('brown-noise');
  });
});
