/** Isolated stylesheet for the on-page task rail (Shadow DOM). Matches popup tokens. */
export const TASK_RAIL_STYLES = `
:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  top: 50% !important;
  right: 0 !important;
  transform: translateY(-50%) !important;
  z-index: 2147483646 !important;
  pointer-events: none;

  --aegis-bg: #f6f4f1;
  --aegis-bg-warm: #f3f1ed;
  --aegis-surface: #ffffff;
  --aegis-text: #1c1917;
  --aegis-text-strong: #1c1917;
  --aegis-text-muted: #78716c;
  --aegis-text-faint: #a8a29e;
  --aegis-primary: #b45309;
  --aegis-primary-hover: #9a3412;
  --aegis-primary-soft: #fff7ed;
  --aegis-primary-border: #fed7aa;
  --aegis-on-primary: #ffffff;
  --aegis-secondary: #292524;
  --aegis-on-secondary: #fafaf9;
  --aegis-border: #e7e5e4;
  --aegis-border-strong: #d6d3d1;
  --aegis-success: #047857;
  --aegis-radius-sm: 6px;
  --aegis-radius-md: 8px;
  --aegis-radius-lg: 10px;
  --aegis-radius-xl: 12px;
  --aegis-radius-full: 9999px;
  --aegis-shadow-soft: 0 1px 2px rgba(28, 25, 23, 0.04);
  --aegis-font: Inter, system-ui, sans-serif;
}

.aegis-v0x-rail {
  pointer-events: auto;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  box-sizing: border-box;
  width: 22px;
  min-width: 22px;
  max-width: 22px;
  height: 148px;
  max-height: 148px;
  overflow: hidden;
  border-radius: var(--aegis-radius-lg) 0 0 var(--aegis-radius-lg);
  border: 1px solid var(--aegis-border);
  border-right: none;
  background: var(--aegis-surface);
  box-shadow: var(--aegis-shadow-soft);
  font-family: var(--aegis-font);
  color: var(--aegis-text);
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  transition:
    width 160ms ease,
    min-width 160ms ease,
    max-width 160ms ease,
    height 160ms ease,
    max-height 160ms ease;
}

.aegis-v0x-rail:hover,
.aegis-v0x-rail:focus-within {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  height: auto;
  max-height: min(70vh, 520px);
}

.aegis-v0x-spine {
  flex: 0 0 22px;
  width: 22px;
  min-width: 22px;
  max-width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aegis-primary);
  background: var(--aegis-primary-soft);
  border-right: 1px solid var(--aegis-primary-border);
  user-select: none;
}

.aegis-v0x-hull {
  flex: 0 0 258px;
  width: 258px;
  min-width: 258px;
  max-width: 258px;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  padding: 12px 12px 12px 10px;
  overflow: auto;
  background: var(--aegis-bg);
  transition: opacity 120ms ease;
  scrollbar-width: thin;
  scrollbar-color: var(--aegis-border) transparent;
}

.aegis-v0x-hull::-webkit-scrollbar {
  width: 4px;
}

.aegis-v0x-hull::-webkit-scrollbar-thumb {
  background: var(--aegis-border);
  border-radius: var(--aegis-radius-full);
}

.aegis-v0x-rail:hover .aegis-v0x-hull,
.aegis-v0x-rail:focus-within .aegis-v0x-hull {
  opacity: 1;
  pointer-events: auto;
}

.aegis-v0x-beacon {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--aegis-text);
}

.aegis-v0x-swarm {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aegis-v0x-node {
  border: 1px solid var(--aegis-border);
  border-radius: var(--aegis-radius-md);
  background: var(--aegis-surface);
  padding: 12px;
}

.aegis-v0x-node--active {
  border-color: var(--aegis-primary-border);
  background: var(--aegis-primary-soft);
}

.aegis-v0x-node--finished {
  opacity: 0.72;
}

.aegis-v0x-signal {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--aegis-text-faint);
}

.aegis-v0x-node--active .aegis-v0x-signal {
  color: var(--aegis-primary);
}

.aegis-v0x-node--finished .aegis-v0x-signal {
  color: var(--aegis-success);
}

.aegis-v0x-codex {
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--aegis-text-strong);
  word-break: break-word;
}

.aegis-v0x-focus {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--aegis-text-faint);
}

.aegis-v0x-node--active .aegis-v0x-focus {
  color: var(--aegis-primary);
}

.aegis-v0x-node--finished .aegis-v0x-codex {
  text-decoration: line-through;
}

.aegis-v0x-actuators {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.aegis-v0x-actuator {
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--aegis-radius-md);
  padding: 6px 10px;
  min-height: 32px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.aegis-v0x-actuator:focus-visible {
  outline: 2px solid var(--aegis-primary);
  outline-offset: 2px;
}

.aegis-v0x-actuator--engage {
  background: var(--aegis-primary);
  color: var(--aegis-on-primary);
}

.aegis-v0x-actuator--engage:hover {
  background: var(--aegis-primary-hover);
}

.aegis-v0x-actuator--complete {
  background: var(--aegis-secondary);
  color: var(--aegis-on-secondary);
}

.aegis-v0x-actuator--complete:hover {
  background: #1c1917;
}

.aegis-v0x-actuator:not(.aegis-v0x-actuator--engage):not(.aegis-v0x-actuator--complete) {
  background: var(--aegis-surface);
  color: var(--aegis-text);
  border-color: var(--aegis-border-strong);
}

.aegis-v0x-actuator:not(.aegis-v0x-actuator--engage):not(.aegis-v0x-actuator--complete):hover {
  background: var(--aegis-bg-warm);
}

.aegis-v0x-void {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--aegis-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .aegis-v0x-rail,
  .aegis-v0x-hull {
    transition: none;
  }
}
`;
