/**
 * Clutch design tokens — same palette across web, mobile, and extension.
 * Extension uses CSS-in-JS (no Tailwind) for the popup since bundle size matters.
 */

export const tokens = {
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
  gold: '#C9A961',
  goldHover: '#D2B670',
  cream: '#F5F1E8',
  moss: '#5C7456',
  rust: '#A85B3B',
} as const
