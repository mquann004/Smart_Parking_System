/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parking: {
          bg: '#0f172a',
          surface: '#1e293b',
          accent: '#38bdf8',
          success: '#16a34a',
          danger: '#dc2626',
          warning: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}

