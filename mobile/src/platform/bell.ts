import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { BellPlayer } from './interfaces';

let player: AudioPlayer | null = null;
let modeReady: Promise<void> | null = null;

async function ensureMode(): Promise<void> {
  if (!modeReady) {
    modeReady = setAudioModeAsync({ playsInSilentMode: true }).then(
      () => undefined,
      (error: unknown) => {
        console.error('[focus] audio mode failed', error);
      },
    );
  }
  await modeReady;
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../assets/sounds/freesound-bell.mp3'),
    );
  }
  return player;
}

export function createBellPlayer(): BellPlayer {
  return {
    play(): void {
      void (async () => {
        try {
          await ensureMode();
          const audio = getPlayer();
          await audio.seekTo(0);
          audio.play();
        } catch (error: unknown) {
          console.error('[focus] completion sound failed', error);
        }
      })();
    },
  };
}
