/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: 'rgb(var(--lab-bg) / <alpha-value>)',
          panel: 'rgb(var(--lab-panel) / <alpha-value>)',
          raised: 'rgb(var(--lab-raised) / <alpha-value>)',
          line: 'rgb(var(--lab-line) / <alpha-value>)',
          text: 'rgb(var(--lab-text) / <alpha-value>)',
          muted: 'rgb(var(--lab-muted) / <alpha-value>)',
          accent: 'rgb(var(--lab-accent) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgb(0 0 0 / 0.08), 0 8px 24px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
};
