import type { Command } from '../../background/messages';
import type { VoidResult } from '@core/types';

export async function sendCommand(command: Command): Promise<VoidResult> {
  try {
    const response = (await chrome.runtime.sendMessage(command)) as VoidResult | undefined;
    if (!response || typeof response !== 'object' || !('ok' in response)) {
      return { ok: false, error: 'No response from background' };
    }
    return response;
  } catch (error: unknown) {
    console.error('[focus] sendCommand failed', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach the extension worker',
    };
  }
}
