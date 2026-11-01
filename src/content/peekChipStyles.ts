/** Isolated stylesheet for the on-page peek countdown (Shadow DOM). */
export const PEEK_CHIP_STYLES = `
:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  top: 16px !important;
  right: 16px !important;
  z-index: 2147483647 !important;
  pointer-events: none;

  --aegis-surface: #ffffff;
  --aegis-text: #1c1917;
  --aegis-text-muted: #78716c;
  --aegis-primary: #b45309;
  --aegis-primary-soft: #fff7ed;
  --aegis-primary-border: #fed7aa;
  --aegis-border: #e7e5e4;
  --aegis-radius-md: 8px;
  --aegis-shadow-soft: 0 1px 2px rgba(28, 25, 23, 0.06);
  --aegis-font: Inter, system-ui, sans-serif;
}

.aegis-v0x-flare {
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: min(240px, calc(100vw - 32px));
  padding: 8px 12px;
  border-radius: var(--aegis-radius-md);
  border: 1px solid var(--aegis-border);
  background: var(--aegis-surface);
  box-shadow: var(--aegis-shadow-soft);
  font-family: var(--aegis-font);
  color: var(--aegis-text);
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
}

.aegis-v0x-murmur {
  font-size: 12px;
  font-weight: 600;
  color: var(--aegis-text-muted);
  white-space: nowrap;
}

.aegis-v0x-chrono {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--aegis-text);
  white-space: nowrap;
}

.aegis-v0x-flare--ember {
  border-color: var(--aegis-primary-border);
  background: var(--aegis-primary-soft);
}

@media (prefers-reduced-motion: reduce) {
  .aegis-v0x-flare--ember {
    animation: none;
  }
}
`;
