/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Hue 1 · Sage (primary): growth, consistency ── */
        sage: {
          50: '#eef5ee',
          100: '#d9e9da',
          200: '#b3d3b6',
          300: '#8cbd92',
          400: '#6aa772',
          500: '#4a7c59',
          600: '#3e6a4b',
          700: '#31563d',
          800: '#25422e',
          900: '#1a2e20',
        },
        /* ── Hue 2 · Peach (accent): warmth, humanity ── */
        peach: {
          50: '#fdf3ec',
          100: '#fbe3d1',
          200: '#f6c8a6',
          300: '#f0ad7b',
          400: '#e8a87c',
          500: '#d98b56',
          600: '#bd6f3d',
          700: '#98562f',
          800: '#734127',
          900: '#4f2d1c',
        },
        /* ── Hue 3 · Mint (calm): breath, space ── */
        mint: {
          50: '#f6faf6',
          100: '#e9f3ea',
          200: '#d4e4d6',
          300: '#b9d3bc',
          400: '#9cc0a0',
          500: '#7fa985',
          600: '#648a6a',
          700: '#4f6d54',
          800: '#3b5140',
          900: '#2d4a33',
        },
        /* ── Semantic tokens (drive light/dark through CSS vars) ── */
        page: 'rgb(var(--page) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        /* ── Calendar heat-map (semantic, not part of the 3 main hues) ── */
        cal: {
          none: 'rgb(var(--cal-none) / <alpha-value>)',
          empty: 'rgb(var(--cal-empty) / <alpha-value>)',
          partial: 'rgb(var(--cal-partial) / <alpha-value>)',
          full: 'rgb(var(--cal-full) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        calm: '1.25rem',
        'calm-sm': '0.85rem',
        'calm-lg': '1.5rem',
      },
      boxShadow: {
        calm: '0 10px 30px -12px rgb(var(--shadow) / 0.25)',
        'calm-lg': '0 22px 45px -18px rgb(var(--shadow) / 0.35)',
      },
      transitionDuration: {
        calm: '300ms',
        'calm-slow': '500ms',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
