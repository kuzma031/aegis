/** Isolated stylesheet for the on-page peek countdown (Shadow DOM). */
export const PEEK_CHIP_STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap");

:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  top: 16px !important;
  right: 16px !important;
  z-index: 2147483647 !important;
  pointer-events: none;

  --aegis-surface: #ffffff;
  --aegis-text: #0f172a;
  --aegis-text-muted: #64748b;
  --aegis-primary: #b45309;
  --aegis-primary-soft: #fef3c7;
  --aegis-primary-border: #fde68a;
  --aegis-border: #eee5d8;
  --aegis-radius-full: 9999px;
  --aegis-shadow-soft: 0 1px 3px rgba(87, 83, 78, 0.04), 0 8px 24px -6px rgba(87, 83, 78, 0.14);
  --aegis-font: "Plus Jakarta Sans", system-ui, sans-serif;
}

.aegis-v0x-flare {
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: min(240px, calc(100vw - 32px));
  padding: 8px 12px;
  border-radius: var(--aegis-radius-full);
  border: 1px solid var(--aegis-primary-border);
  background: linear-gradient(180deg, #fffdf9, var(--aegis-primary-soft));
  box-shadow: var(--aegis-shadow-soft);
  font-family: var(--aegis-font);
  color: var(--aegis-text);
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
}

.aegis-v0x-murmur {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--aegis-primary);
  white-space: nowrap;
}

.aegis-v0x-chrono {
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--aegis-text);
  white-space: nowrap;
}

.aegis-v0x-flare--ember {
  animation: aegis-v0x-pulse 1.1s ease-in-out infinite;
  border-color: #f59e0b;
}

@keyframes aegis-v0x-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: var(--aegis-shadow-soft);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 1px 3px rgba(180, 83, 9, 0.12), 0 10px 28px -6px rgba(180, 83, 9, 0.28);
  }
}
`;
