/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Clutch's signature palette: deep ink, warm gold accent, soft cream
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
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Geist"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.4s ease-out',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
}
