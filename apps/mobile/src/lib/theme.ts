export const theme = {
  colors: {
    // Deep ink palette (dark theme primary)
    ink: {
      50: '#F5F4F1',
      100: '#E8E6DF',
      200: '#C9C5B7',
      300: '#9A9485',
      400: '#5C574A',
      500: '#3A3528',
      600: '#26221A',
      700: '#1A1712',
      800: '#13110D',
      900: '#0B0A07',
    },
    // Warm gold accent — Clutch's signature
    gold: {
      DEFAULT: '#C9A961',
      50: '#F8F2DF',
      100: '#EFE3B7',
      200: '#E0CC85',
      300: '#D2B670',
      400: '#C9A961',
      500: '#A88D44',
      600: '#7E6B33',
    },
    cream: '#F5F1E8',
    moss: '#5C7456',
    rust: '#A85B3B',
  },
  fonts: {
    display: 'Fraunces',
    sans: 'Geist',
    mono: 'JetBrainsMono',
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
} as const

export type Theme = typeof theme
