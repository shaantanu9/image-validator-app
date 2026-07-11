import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Coral — the product's one loud colour. Still named `primary` so any
        // surface that reaches for `primary-*` lands on brand, not stock blue.
        primary: {
          50: '#fff5f1',
          100: '#ffe7dd',
          200: '#ffcab5',
          300: '#fda98a',
          400: '#fb8a62',
          500: '#f26a3d',
          600: '#e14e22',
          700: '#bc3c17',
          800: '#963117',
          900: '#7a2b17',
        },
        // Amber. Only ever the far end of the progress gradient — never a fill.
        ember: {
          300: '#fdd67a',
          400: '#fbbf54',
          500: '#f5a623',
        },
        // Every grey in the app is one of these, so nothing reads cold beside coral.
        sand: {
          50: '#faf9f7',
          100: '#f4f2ef',
          200: '#edebe7',
          300: '#dfdbd5',
          400: '#b9b3ab',
          500: '#8c867e',
          600: '#6b655d',
          700: '#4a453f',
          800: '#2c2a27',
          900: '#16171b',
        },
        success: {
          50: '#f0fbf4',
          200: '#bbf0cf',
          500: '#22c55e',
          700: '#15803d',
        },
        danger: {
          50: '#fdf2f4',
          200: '#fbd0d8',
          500: '#f1556c',
          700: '#be123c',
        },
      },
      fontFamily: {
        // Poppins carries the personality (headings, numerals, the loud copy).
        // Inter does the quiet work (fields, filenames, captions).
        display: ['var(--font-display)', 'Poppins', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        // Warm-tinted rather than the default cold black: shadows fall on sand.
        card: '0 1px 2px rgba(22, 23, 27, 0.04), 0 8px 24px -12px rgba(22, 23, 27, 0.08)',
        lift: '0 2px 4px rgba(22, 23, 27, 0.05), 0 16px 40px -16px rgba(22, 23, 27, 0.14)',
        glow: '0 8px 24px -8px rgba(242, 106, 61, 0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
