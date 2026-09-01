/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12241f',
        forest: {
          DEFAULT: '#0d5c4d',
          dark: '#0a463b',
          light: '#1a7a66',
        },
        leaf: '#1f8a70',
        sand: '#f3eee4',
        clay: '#e7dcc8',
        paper: '#fffcf7',
        muted: '#5c6b66',
        line: '#d9d0c0',
        amber: {
          DEFAULT: '#c47b1a',
          soft: '#f8ead3',
        },
        danger: {
          DEFAULT: '#b42318',
          soft: '#fde8e6',
        },
        success: {
          DEFAULT: '#157a4b',
          soft: '#e3f5ea',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(18,36,31,0.04), 0 8px 24px -12px rgba(18,36,31,0.18)',
        lift: '0 12px 32px -16px rgba(18,36,31,0.28)',
      },
      maxWidth: {
        app: '72rem',
      },
    },
  },
  plugins: [],
};
