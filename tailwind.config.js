/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        'bg-secondary': '#F5F5F5',
        surface: '#FFFFFF',
        'surface-hover': '#F8F8F8',
        border: '#E5E5E5',
        divider: '#EEEEEE',
        'text-primary': '#111111',
        'text-secondary': '#555555',
        'text-muted': '#888888',
        accent: '#2563EB',
        'accent-hover': '#1D4ED8',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        button: '14px',
        card: '16px',
        input: '12px',
        dialog: '20px',
        badge: '999px',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,.06)',
        dialog: '0 20px 60px rgba(0,0,0,.12)',
        dropdown: '0 12px 24px rgba(0,0,0,.08)',
        neo: '4px 4px 0 #111111',
        'neo-lg': '6px 6px 0 #111111',
        'neo-sm': '2px 2px 0 #111111',
      },
    },
  },
  plugins: [],
}
