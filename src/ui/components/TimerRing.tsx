import type { ReactNode } from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 66;

export function TimerRing({
  progress,
  children,
}: {
  /** 0–1 filled portion of the ring */
  progress: number;
  children: ReactNode;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <div className="timer-ring">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle
          cx="80"
          cy="80"
          r="66"
          stroke="var(--color-ring-track)"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="80"
          cy="80"
          r="66"
          stroke="var(--color-primary)"
          strokeWidth="6"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="timer-ring-center">{children}</div>
    </div>
  );
}