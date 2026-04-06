/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cache: {
          hit: '#22c55e',
          miss: '#ef4444',
          evicted: '#eab308',
          empty: '#475569',
        },
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) 1',
        'flash-green': 'flashGreen 0.6s ease-out',
        'flash-red': 'flashRed 0.6s ease-out',
        'flash-yellow': 'flashYellow 0.6s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        flashGreen: {
          '0%': { boxShadow: '0 0 20px 8px rgba(34,197,94,0.8)', transform: 'scale(1.08)' },
          '100%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
        },
        flashRed: {
          '0%': { boxShadow: '0 0 20px 8px rgba(239,68,68,0.8)', transform: 'scale(1.08)' },
          '100%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
        },
        flashYellow: {
          '0%': { boxShadow: '0 0 20px 8px rgba(234,179,8,0.8)', transform: 'scale(1.08)' },
          '100%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
