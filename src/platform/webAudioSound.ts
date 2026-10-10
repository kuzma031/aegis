/** Play a short SFX via Web Audio so Chrome Global Media Controls usually stay hidden. */

let sharedContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

function getContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

let previewSource: AudioBufferSourceNode | null = null;
let previewUrl: string | null = null;

async function loadBuffer(context: AudioContext, url: string): Promise<AudioBuffer> {
  let buffer = bufferCache.get(url);
  if (!buffer) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sound (${response.status})`);
    }
    const data = await response.arrayBuffer();
    buffer = await context.decodeAudioData(data.slice(0));
    bufferCache.set(url, buffer);
  }
  return buffer;
}

export function stopPreviewLoop(): void {
  const source = previewSource;
  previewSource = null;
  previewUrl = null;
  if (!source) {
    return;
  }
  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}

/** Loop a clip in this document. Stops when the document closes or stopPreviewLoop runs. */
export async function previewLoop(url: string): Promise<void> {
  if (previewUrl === url && previewSource) {
    return;
  }
  stopPreviewLoop();

  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  const buffer = await loadBuffer(context, url);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(context.destination);
  source.onended = () => {
    if (previewSource === source) {
      previewSource = null;
      previewUrl = null;
    }
  };
  source.start(0);
  previewSource = source;
  previewUrl = url;
}

export async function playUrlWithWebAudio(url: string): Promise<void> {
  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  const buffer = await loadBuffer(context, url);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}
