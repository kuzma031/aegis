export const colors = {
  bg: '#f6f4f1',
  bgWarm: '#f3f1ed',
  surface: '#ffffff',
  surfaceLow: '#f3f1ed',
  surfaceInset: '#eceae6',
  banner: '#f3f1ed',
  text: '#1c1917',
  textStrong: '#1c1917',
  textMuted: '#78716c',
  textFaint: '#a8a29e',
  primary: '#b45309',
  primaryHover: '#9a3412',
  primaryBright: '#c2410c',
  primarySoft: '#fff7ed',
  primaryTint: '#fff7ed',
  primaryBorder: '#fed7aa',
  onPrimary: '#ffffff',
  secondary: '#292524',
  secondaryHover: '#1c1917',
  onSecondary: '#fafaf9',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  borderHeader: '#e7e5e4',
  borderNav: '#e7e5e4',
  ringTrack: '#e7e5e4',
  success: '#047857',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  dangerText: '#991b1b',
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  full: 9999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const controlMin = 36;
