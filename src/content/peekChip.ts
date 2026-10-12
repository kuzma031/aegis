import { formatClock } from '@core/format';
import type { AppState } from '@core/types';
import { migrate } from '@platform/migrations';
import { STORAGE_KEY } from '@platform/storage';
import { PEEK_CHIP_STYLES } from './peekChipStyles';

const HOST_TAG = 'aegis-v0x-glint';
const URGENT_MS = 30_000;

async function loadState(): Promise<AppState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return migrate(stored[STORAGE_KEY], Date.now());
}

function pageHost(): string {
  return window.location.hostname.replace(/^www\./, '');
}

function peekExpiresAt(state: AppState, now: number): number | null {
  const session = state.activeSession;
  if (!session) {
    return null;
  }
  const host = pageHost();
  const grant = session.run.peekGrants.find(
    (entry) => entry.host === host && entry.expiresAt > now,
  );
  return grant?.expiresAt ?? null;
}

function ensureHost(): HTMLElement {
  const existing = document.querySelector(HOST_TAG);
  if (existing instanceof HTMLElement) {
    return existing;
  }
  const host = document.createElement(HOST_TAG);
  host.style.cssText =
    'all:initial;display:block!important;position:fixed!important;top:16px!important;right:16px!important;z-index:2147483647!important;pointer-events:none;';
  document.documentElement.appendChild(host);
  return host;
}

function removeHost(): void {
  document.querySelector(HOST_TAG)?.remove();
}

function renderChip(shadow: ShadowRoot, remainingMs: number): void {
  let flare = shadow.querySelector('.aegis-v0x-flare');
  if (!(flare instanceof HTMLElement)) {
    flare = document.createElement('div');
    flare.className = 'aegis-v0x-flare';
    flare.setAttribute('role', 'status');
    flare.setAttribute('aria-live', 'polite');
    flare.setAttribute('aria-label', 'Peek time remaining');
    shadow.appendChild(flare);

    const murmur = document.createElement('span');
    murmur.className = 'aegis-v0x-murmur';
    murmur.textContent = 'Peek';

    const chrono = document.createElement('span');
    chrono.className = 'aegis-v0x-chrono';

    flare.append(murmur, chrono);
  }

  const chrono = flare.querySelector('.aegis-v0x-chrono');
  if (chrono) {
    chrono.textContent = formatClock(remainingMs);
  }

  flare.classList.toggle('aegis-v0x-flare--ember', remainingMs <= URGENT_MS);
}

export function mountPeekChip(): void {
  if (window !== window.top) {
    return;
  }

  let latestState: AppState | null = null;
  let tickId: number | null = null;

  const stopTick = () => {
    if (tickId != null) {
      window.clearInterval(tickId);
      tickId = null;
    }
  };

  const ensureShadow = (): ShadowRoot => {
    const host = ensureHost();
    const root =
      host.shadowRoot ??
      host.attachShadow({
        mode: 'open',
      });
    if (!root.querySelector('style[data-aegis-v0x-glint]')) {
      const style = document.createElement('style');
      style.dataset.aegisV0xGlint = '1';
      style.textContent = PEEK_CHIP_STYLES;
      root.appendChild(style);
    }
    return root;
  };

  const paint = (state: AppState, now = Date.now()) => {
    const expiresAt = peekExpiresAt(state, now);
    if (expiresAt == null) {
      stopTick();
      removeHost();
      return;
    }

    const remainingMs = Math.max(0, expiresAt - now);
    if (remainingMs <= 0) {
      stopTick();
      removeHost();
      return;
    }

    const root = ensureShadow();
    renderChip(root, remainingMs);

    if (tickId == null) {
      tickId = window.setInterval(() => {
        if (!latestState) {
          return;
        }
        paint(latestState, Date.now());
      }, 1000);
    }
  };

  const refresh = () => {
    void loadState()
      .then((state) => {
        latestState = state;
        paint(state);
      })
      .catch((error: unknown) => {
        console.error('[aegis] peek chip load failed', error);
      });
  };

  refresh();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    refresh();
  });
}
