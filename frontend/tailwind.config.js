/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'runeterra': {
          'dark': '#0a0e27',
          'darker': '#010310',
          'gold': '#c8aa6e',
          'gold-light': '#f0e6d2',
          'blue': '#0ac8b9',
          'blue-dark': '#0397ab',
          'purple': '#a855f7',
          'red': '#d13639',
        },
      },
      fontFamily: {
        'display': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #c8aa6e, 0 0 10px #c8aa6e' },
          '100%': { boxShadow: '0 0 10px #c8aa6e, 0 0 20px #c8aa6e, 0 0 30px #c8aa6e' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
