/** Isolated stylesheet for the on-page task rail (Shadow DOM). Matches popup tokens. */
export const TASK_RAIL_STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");

:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  top: 50% !important;
  right: 0 !important;
  transform: translateY(-50%) !important;
  z-index: 2147483646 !important;
  pointer-events: none;

  --aegis-bg: #fbf9f6;
  --aegis-bg-warm: #faf7f2;
  --aegis-surface: #ffffff;
  --aegis-text: #0f172a;
  --aegis-text-strong: #1e293b;
  --aegis-text-muted: #64748b;
  --aegis-text-faint: #94a3b8;
  --aegis-primary: #b45309;
  --aegis-primary-hover: #92400e;
  --aegis-primary-bright: #d97706;
  --aegis-primary-soft: #fef3c7;
  --aegis-primary-tint: #fffbeb;
  --aegis-primary-border: #fde68a;
  --aegis-on-primary: #ffffff;
  --aegis-secondary: #1e293b;
  --aegis-on-secondary: #faf8f5;
  --aegis-border: #eee5d8;
  --aegis-border-strong: #e5dcce;
  --aegis-success: #047857;
  --aegis-radius-sm: 6px;
  --aegis-radius-md: 10px;
  --aegis-radius-lg: 12px;
  --aegis-radius-xl: 14px;
  --aegis-radius-full: 9999px;
  --aegis-shadow-soft: 0 1px 3px rgba(87, 83, 78, 0.04), 0 2px 6px -1px rgba(87, 83, 78, 0.06);
  --aegis-font: "Plus Jakarta Sans", system-ui, sans-serif;
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
  box-shadow: var(--aegis-shadow-soft), -6px 0 20px rgba(87, 83, 78, 0.06);
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
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
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
  background:
    radial-gradient(ellipse 90% 40% at 100% 0%, rgba(253, 230, 138, 0.28), transparent 55%),
    var(--aegis-bg);
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
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aegis-primary);
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
  box-shadow: var(--aegis-shadow-soft);
}

.aegis-v0x-node--active {
  border-color: var(--aegis-primary-border);
  background: var(--aegis-primary-tint);
}

.aegis-v0x-node--finished {
  opacity: 0.72;
}

.aegis-v0x-signal {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
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
  border-radius: var(--aegis-radius-full);
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 80ms ease;
}

.aegis-v0x-actuator:active {
  transform: scale(0.98);
}

.aegis-v0x-actuator:focus-visible {
  outline: 2px solid var(--aegis-primary);
  outline-offset: 2px;
}

.aegis-v0x-actuator--engage {
  background: linear-gradient(90deg, #b45309, #d97706, #b45309);
  color: var(--aegis-on-primary);
  box-shadow: 0 4px 12px rgba(180, 83, 9, 0.25);
}

.aegis-v0x-actuator--engage:hover {
  background: linear-gradient(90deg, #92400e, #b45309, #92400e);
}

.aegis-v0x-actuator--complete {
  background: var(--aegis-secondary);
  color: var(--aegis-on-secondary);
}

.aegis-v0x-actuator--complete:hover {
  background: #0f172a;
}

.aegis-v0x-actuator:not(.aegis-v0x-actuator--engage):not(.aegis-v0x-actuator--complete) {
  background: var(--aegis-bg-warm);
  color: #334155;
  border-color: var(--aegis-border-strong);
  border-radius: var(--aegis-radius-xl);
}

.aegis-v0x-actuator:not(.aegis-v0x-actuator--engage):not(.aegis-v0x-actuator--complete):hover {
  background: #f3ece2;
  color: var(--aegis-text-strong);
}

.aegis-v0x-void {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--aegis-text-muted);
}
`;
