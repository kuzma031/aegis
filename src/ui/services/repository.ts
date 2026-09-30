import { createSystemClock } from '@platform/clock';
import { ChromeStateRepository, type StateRepository } from '@platform/storage';

const clock = createSystemClock();

let repository: StateRepository | null = null;

export function getAppRepository(): StateRepository {
  if (!repository) {
    repository = new ChromeStateRepository(clock);
  }
  return repository;
}
