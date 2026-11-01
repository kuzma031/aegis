import { useEffect, useState } from 'react';
import {
  AMBIENT_TRACKS,
  ambientTrackFile,
  type AmbientTrackId,
} from '@core/ambientAudio';
import {
  COMPLETION_SOUNDS,
  completionSoundFile,
  type CompletionSoundId,
} from '@core/completionFeedback';
import type { AppState, Settings, TaskPresentation } from '@core/types';
import { playUrlWithWebAudio, previewLoop, stopPreviewLoop } from '@platform/webAudioSound';
import { Toggle } from '../components/Toggle';
import { IconShield } from '../components/icons';
import { getAppRepository } from '../services/repository';

const PRESENTATION_OPTIONS: {
  value: TaskPresentation;
  title: string;
  description: string;
}[] = [
  {
    value: 'extension',
    title: 'Extension only',
    description: 'Manage tasks from the Tasks tab in this popup.',
  },
  {
    value: 'sidepanel',
    title: 'Side panel',
    description: 'Show tasks in Chrome’s side panel beside the page.',
  },
  {
    value: 'hover',
    title: 'Page hover rail',
    description: 'Show the task rail on the edge of web pages (current default).',
  },
];

async function patchSettings(patch: Partial<Settings>) {
  await getAppRepository().update((current) => ({
    ...current,
    settings: {
      ...current.settings,
      ...patch,
    },
  }));
}

export function SettingsView({ state }: { state: AppState }) {
  const settings = state.settings;
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ambientPreviewError, setAmbientPreviewError] = useState<string | null>(null);
  const sessionPlaying =
    state.activeSession?.status === 'running' && settings.ambientEnabled;

  useEffect(() => {
    if (sessionPlaying) {
      stopPreviewLoop();
    }
  }, [sessionPlaying]);

  useEffect(() => () => stopPreviewLoop(), []);

  async function setPresentation(next: TaskPresentation) {
    await patchSettings({ taskPresentation: next });

    if (next === 'sidepanel') {
      try {
        const win = await chrome.windows.getCurrent();
        if (win.id != null) {
          await chrome.sidePanel.open({ windowId: win.id });
        }
      } catch (error: unknown) {
        console.error('[aegis] could not open side panel', error);
      }
    }
  }

  async function setSound(next: CompletionSoundId) {
    await patchSettings({ completionSoundId: next });
  }

  async function setAmbientEnabled(next: boolean) {
    await patchSettings({ ambientEnabled: next });
  }

  async function setAmbientTrack(next: AmbientTrackId) {
    await patchSettings({ ambientTrackId: next });
  }

  function previewSound(id: CompletionSoundId) {
    setPreviewError(null);
    const url = chrome.runtime.getURL(completionSoundFile(id));
    void playUrlWithWebAudio(url).catch((error: unknown) => {
      console.error('[aegis] preview sound failed', error);
      setPreviewError('Could not play preview');
    });
  }

  function previewAmbient(id: AmbientTrackId) {
    setAmbientPreviewError(null);
    const url = chrome.runtime.getURL(ambientTrackFile(id));
    void previewLoop(url).catch((error: unknown) => {
      console.error('[aegis] ambient preview failed', error);
      setAmbientPreviewError('Could not play preview');
    });
  }

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <h2 className="screen-title" style={{ margin: 0 }}>
            Settings
          </h2>
        </div>
      </header>

      <div className="screen-body-scroll">
        <section className="settings-section" aria-labelledby="task-presentation-heading">
          <h3 id="task-presentation-heading" className="settings-section-title">
            Task presentation
          </h3>
          <p className="settings-section-copy">
            Choose where task controls appear. The Tasks tab in the extension always stays
            available.
          </p>

          <div className="settings-option-list" role="radiogroup" aria-label="Task presentation">
            {PRESENTATION_OPTIONS.map((option) => {
              const active = settings.taskPresentation === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`settings-option${active ? ' settings-option--active' : ''}`}
                  onClick={() => void setPresentation(option.value)}
                >
                  <span className="settings-option-radio" aria-hidden="true" />
                  <span className="settings-option-text">
                    <span className="settings-option-title">{option.title}</span>
                    <span className="settings-option-desc">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="focus-audio-heading">
          <h3 id="focus-audio-heading" className="settings-section-title">
            Focus audio
          </h3>
          <p className="settings-section-copy">
            Loops while a session is running, including breaks. Stops when you pause or end it.
          </p>
          <Toggle
            checked={settings.ambientEnabled}
            onChange={(event) => void setAmbientEnabled(event.target.checked)}
            label="Play during sessions"
          />
          {settings.ambientEnabled ? (
            <div className="settings-option-list" role="radiogroup" aria-label="Focus audio">
              {AMBIENT_TRACKS.map((track) => {
                const active = settings.ambientTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className={`settings-option settings-option--row${active ? ' settings-option--active' : ''}`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className="settings-option-main"
                      onClick={() => void setAmbientTrack(track.id)}
                    >
                      <span className="settings-option-radio" aria-hidden="true" />
                      <span className="settings-option-text">
                        <span className="settings-option-title">{track.label}</span>
                        <span className="settings-option-desc">{track.description}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="settings-preview-btn"
                      disabled={sessionPlaying}
                      title={sessionPlaying ? 'Already playing with this session' : undefined}
                      onClick={() => previewAmbient(track.id)}
                    >
                      Preview
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {ambientPreviewError ? <p className="error-text">{ambientPreviewError}</p> : null}
        </section>

        <section className="settings-section" aria-labelledby="completion-sound-heading">
          <h3 id="completion-sound-heading" className="settings-section-title">
            Completion sound
          </h3>
          <p className="settings-section-copy">
            Plays once when a focus or break phase ends.
          </p>

          <div className="settings-option-list" role="radiogroup" aria-label="Completion sound">
            {COMPLETION_SOUNDS.map((sound) => {
              const active = settings.completionSoundId === sound.id;
              return (
                <div
                  key={sound.id}
                  className={`settings-option settings-option--row${active ? ' settings-option--active' : ''}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className="settings-option-main"
                    onClick={() => void setSound(sound.id)}
                  >
                    <span className="settings-option-radio" aria-hidden="true" />
                    <span className="settings-option-title">{sound.label}</span>
                  </button>
                  <button
                    type="button"
                    className="settings-preview-btn"
                    onClick={() => previewSound(sound.id)}
                  >
                    Preview
                  </button>
                </div>
              );
            })}
          </div>
          {previewError ? <p className="error-text">{previewError}</p> : null}
        </section>
      </div>
    </>
  );
}
