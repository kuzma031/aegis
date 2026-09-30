export interface Clock {
  now(): number;
}

export function createSystemClock(): Clock {
  return {
    now(): number {
      return Date.now();
    },
  };
}
