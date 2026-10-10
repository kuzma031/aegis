const OFFSCREEN_URL = 'offscreen.html';
const PING_MESSAGE = 'OFFSCREEN_PING' as const;

const READY_ATTEMPTS = 40;
const READY_DELAY_MS = 25;

let creating: Promise<void> | null = null;

export async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return contexts.length > 0;
}

export async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play focus audio and a sound when a session phase ends',
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureOffscreenReady(): Promise<void> {
  await ensureOffscreenDocument();
  let lastError: unknown;
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    try {
      const response = (await chrome.runtime.sendMessage({ type: PING_MESSAGE })) as
        | { ok?: boolean }
        | undefined;
      if (response?.ok) {
        return;
      }
    } catch (error: unknown) {
      lastError = error;
    }
    await sleep(READY_DELAY_MS);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Offscreen audio document did not become ready');
}
