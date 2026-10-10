export type AmbientTrackId = 'brown-noise' | 'cafe' | 'lofi';

export const DEFAULT_AMBIENT_TRACK: AmbientTrackId = 'brown-noise';

export const AMBIENT_TRACKS: ReadonlyArray<{
  id: AmbientTrackId;
  label: string;
  description: string;
  /** Path relative to extension root (public/). */
  file: string;
}> = [
  {
    id: 'brown-noise',
    label: 'Brown noise',
    description: 'Soft low rumble',
    file: 'sounds/brown-noise.wav',
  },
  {
    id: 'cafe',
    label: 'Café',
    description: 'Distant room murmur',
    file: 'sounds/cafe-noise.mp3',
  },
  {
    id: 'lofi',
    label: 'Lo-fi',
    description: 'Slow beat, no vocals',
    file: 'sounds/lofi-hop.wav',
  },
];

const TRACK_IDS = new Set(AMBIENT_TRACKS.map((track) => track.id));

export function isAmbientTrackId(value: unknown): value is AmbientTrackId {
  return typeof value === 'string' && TRACK_IDS.has(value as AmbientTrackId);
}

export function ambientTrackFile(id: AmbientTrackId): string {
  const track = AMBIENT_TRACKS.find((item) => item.id === id);
  return track?.file ?? AMBIENT_TRACKS[0]!.file;
}

/** Track to loop, or null when audio is off or the session is not running. */
export function ambientTrackForSession(
  enabled: boolean,
  trackId: unknown,
  sessionStatus: 'running' | 'paused' | null | undefined,
): AmbientTrackId | null {
  if (!enabled || sessionStatus !== 'running') {
    return null;
  }
  return isAmbientTrackId(trackId) ? trackId : DEFAULT_AMBIENT_TRACK;
}
