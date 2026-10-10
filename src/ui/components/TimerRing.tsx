import type { ReactNode } from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 66;

export function TimerRing({
  progress,
  children,
  gradientId = 'aegisTimerGradient',
}: {
  /** 0–1 filled portion of the ring */
  progress: number;
  children: ReactNode;
  gradientId?: string;
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
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx="80"
          cy="80"
          r="66"
          stroke={`url(#${gradientId})`}
          strokeWidth="7"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="60%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="timer-ring-center">{children}</div>
    </div>
  );
}
