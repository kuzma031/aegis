import { useId, type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

export function IconContexts(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

export function IconStats(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

export function IconTasks(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.983 3.5a1.5 1.5 0 011.47 1.2l.14.7a7.97 7.97 0 012.02.83l.64-.35a1.5 1.5 0 012.05.55l.75 1.3a1.5 1.5 0 01-.55 2.05l-.64.37c.17.66.26 1.35.26 2.05s-.09 1.39-.26 2.05l.64.37a1.5 1.5 0 01.55 2.05l-.75 1.3a1.5 1.5 0 01-2.05.55l-.64-.35a7.97 7.97 0 01-2.02.83l-.14.7a1.5 1.5 0 01-1.47 1.2h-1.5a1.5 1.5 0 01-1.47-1.2l-.14-.7a7.97 7.97 0 01-2.02-.83l-.64.35a1.5 1.5 0 01-2.05-.55l-.75-1.3a1.5 1.5 0 01.55-2.05l.64-.37A8.2 8.2 0 014.5 12c0-.7.09-1.39.26-2.05l-.64-.37a1.5 1.5 0 01-.55-2.05l.75-1.3a1.5 1.5 0 012.05-.55l.64.35a7.97 7.97 0 012.02-.83l.14-.7A1.5 1.5 0 0110.483 3.5h1.5z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  const uid = useId().replace(/:/g, '');
  const shieldGrad = `shieldGrad-${uid}`;
  const goldGleam = `goldGleam-${uid}`;
  const darkBg = `darkBg-${uid}`;

  return (
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={shieldGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={goldGleam} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={darkBg} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2d1d0c" />
          <stop offset="100%" stopColor="#180e05" />
        </linearGradient>
      </defs>
      <path
        d="M 256 44 C 360 44 424 96 424 204 C 424 332 328 424 256 468 C 184 424 88 332 88 204 C 88 96 152 44 256 44 Z"
        fill={`url(#${shieldGrad})`}
      />
      <path
        d="M 256 68 C 342 68 396 112 396 208 C 396 316 312 396 256 436 C 200 396 116 316 116 208 C 116 112 170 68 256 68 Z"
        fill={`url(#${darkBg})`}
      />
      <circle
        cx="256"
        cy="224"
        r="112"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.6"
      />
      <circle
        cx="256"
        cy="224"
        r="88"
        fill="none"
        stroke={`url(#${goldGleam})`}
        strokeWidth="3"
        opacity="0.8"
      />
      <circle cx="256" cy="224" r="64" fill="#b45309" fillOpacity="0.3" />
      <g stroke={`url(#${goldGleam})`} strokeWidth="3.5" strokeLinecap="round">
        <line x1="256" y1="136" x2="256" y2="152" />
        <line x1="318" y1="162" x2="306" y2="174" />
        <line x1="344" y1="224" x2="328" y2="224" />
        <line x1="318" y1="286" x2="306" y2="274" />
        <line x1="194" y1="162" x2="206" y2="174" />
        <line x1="168" y1="224" x2="184" y2="224" />
        <line x1="194" y1="286" x2="206" y2="274" />
      </g>
      <path
        d="M 208 224 C 208 224 230 196 256 196 C 282 196 304 224 304 224 C 304 224 282 252 256 252 C 230 252 208 224 208 224 Z"
        fill="none"
        stroke={`url(#${goldGleam})`}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="224" r="14" fill={`url(#${goldGleam})`} />
      <circle cx="256" cy="224" r="6" fill="#180e05" />
      <path
        d="M 220 280 C 236 294 276 294 292 280"
        fill="none"
        stroke={`url(#${goldGleam})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 236 312 C 246 322 266 322 276 312"
        fill="none"
        stroke="#d97706"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="256" cy="350" r="5" fill="#f59e0b" />
      <polygon points="256,48 266,66 256,80 246,66" fill="#fef3c7" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function IconShieldFilled(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v4a1 1 0 102 0V7z"
        clipRule="evenodd"
      />
    </svg>
  );
}
