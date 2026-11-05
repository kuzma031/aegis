import type { PhaseNotification } from '@core/phaseNotifications';

export interface PhaseNotificationScheduler {
  scheduleAll(
    items: { at: number; content: PhaseNotification }[],
  ): Promise<void>;
  cancelAll(): Promise<void>;
  dismissDelivered(): Promise<void>;
}

export interface BellPlayer {
  play(): void;
}

export const noopPhaseNotificationScheduler: PhaseNotificationScheduler = {
  async scheduleAll(): Promise<void> {},
  async cancelAll(): Promise<void> {},
  async dismissDelivered(): Promise<void> {},
};

export const noopBellPlayer: BellPlayer = {
  play(): void {},
};
