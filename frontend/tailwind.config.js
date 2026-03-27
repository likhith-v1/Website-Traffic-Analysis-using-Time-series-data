/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', "[data-theme='dark']"],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: { 925: '#050814' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['"Sora"',               'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"Space Mono"',         'ui-monospace',  'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseAccent: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        slideDownAndFade: {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUpAndFade: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        hide: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'fade-up':          'fadeUp 0.55s ease both',
        'fade-in':          'fadeIn 0.4s ease both',
        'pulse-accent':     'pulseAccent 2.2s ease infinite',
        'shimmer':          'shimmer 1.8s linear infinite',
        'slide-down-fade':  'slideDownAndFade 150ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up-fade':    'slideUpAndFade 150ms cubic-bezier(0.16,1,0.3,1)',
        'hide':             'hide 150ms ease',
      },
    },
  },
  plugins: [],
}
