import type { AppState } from '@core/types';

/** Enable Chrome side panel only when task presentation is sidepanel. */
export async function syncSidePanelFromState(state: AppState): Promise<void> {
  const enabled = state.settings.taskPresentation === 'sidepanel';
  await chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled,
  });
}
