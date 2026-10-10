/** Web Audio playback avoids Chrome's Global Media Controls toolbar chip. */

let sharedContext = null;
const bufferCache = new Map();

let ambientSource = null;
let ambientUrl = null;
let ambientQueue = Promise.resolve();

function getContext() {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

async function loadBuffer(url) {
  let buffer = bufferCache.get(url);
  if (!buffer) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sound (${response.status})`);
    }
    const data = await response.arrayBuffer();
    buffer = await getContext().decodeAudioData(data.slice(0));
    bufferCache.set(url, buffer);
  }
  return buffer;
}

async function playUrlWithWebAudio(url) {
  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  const buffer = await loadBuffer(url);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

function stopAmbient() {
  const source = ambientSource;
  ambientSource = null;
  ambientUrl = null;
  if (!source) {
    return;
  }
  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}

async function startAmbient(url) {
  if (ambientUrl === url && ambientSource) {
    return;
  }
  stopAmbient();

  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  const buffer = await loadBuffer(url);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(context.destination);
  source.onended = () => {
    if (ambientSource === source) {
      ambientSource = null;
      ambientUrl = null;
    }
  };
  source.start(0);
  ambientSource = source;
  ambientUrl = url;
}

function enqueueAmbient(task) {
  const run = ambientQueue.then(task, task);
  ambientQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return;
  }

  if (message.type === 'OFFSCREEN_PING') {
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'STOP_AMBIENT') {
    enqueueAmbient(() => {
      stopAmbient();
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error('[aegis] ambient stop failed', error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type === 'START_AMBIENT') {
    const url = typeof message.url === 'string' ? message.url : '';
    if (!url) {
      sendResponse({ ok: false });
      return;
    }
    enqueueAmbient(() => startAmbient(url))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error('[aegis] ambient play failed', error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type !== 'PLAY_COMPLETION_SOUND') {
    return;
  }

  const url = typeof message.url === 'string' ? message.url : '';
  if (!url) {
    sendResponse({ ok: false });
    return;
  }

  playUrlWithWebAudio(url)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error('[aegis] offscreen play failed', error);
      sendResponse({ ok: false });
    });
  return true;
});
