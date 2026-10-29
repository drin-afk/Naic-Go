/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: '#641C2B', 50: '#F7EEF0', 100: '#EED9DE', 200: '#D9AEB8', 700: '#521622', 800: '#3F111A', 900: '#2B0B12' },
        brand: { DEFAULT: '#A52A3A', 50: '#FBEFF1', 100: '#F6DCE0', 600: '#A52A3A', 700: '#8A2230' },
        accent: { DEFAULT: '#D94747', 50: '#FCEEEE' },
        warm: '#FAF8F6',
        ink: '#29262A',
        muted: '#77727A',
        success: { DEFAULT: '#25845A', 50: '#E9F5EF' },
        warning: { DEFAULT: '#D99A27', 50: '#FDF5E6', 700: '#8A5E0F' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(41,38,42,0.04), 0 4px 16px rgba(41,38,42,0.06)',
        lift: '0 10px 30px rgba(100,28,43,0.12)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
