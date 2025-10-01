module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Balanced low-contrast theme colors
        primary: {
          50: '#fef7ed',
          100: '#fdedd3',
          200: '#fbd7a5',
          300: '#f8b86d',
          400: '#f59432',
          500: '#f2760a',
          600: '#e35a05',
          700: '#bc4208',
          800: '#95350e',
          900: '#782d0f',
        },
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        accent: {
          orange: '#f2760a',
          yellow: '#facc15',
          purple: '#8b5cf6',
          blue: '#3b82f6',
          magenta: '#ec4899',
          red: '#ef4444',
        },
                background: {
                  primary: '#f8fafc',
                  secondary: '#f1f5f9',
                  tertiary: '#e2e8f0',
                // Professional dark backgrounds with navy blues
                'dark-primary': '#0B1426',      // Very dark navy base
                'dark-secondary': '#1E293B',    // Rich dark slate
                'dark-tertiary': '#334155',     // Deep navy blue
                'dark-quaternary': '#475569',  // Medium navy
                'dark-accent-bg': '#1E40AF',   // Navy accent background
                },
                text: {
                  primary: '#334155',
                  secondary: '#64748b',
                  muted: '#94a3b8',
                // Professional text colors
                'dark-primary': '#F8FAFC',      // Very light text
                'dark-secondary': '#E2E8F0',    // Light secondary text
                'dark-muted': '#CBD5E1',        // Muted text
                'dark-accent': '#60A5FA',       // Bright blue accent text
                'dark-highlight': '#FBBF24',    // Golden highlight
                },
                // Professional accent colors with navy blues
                'dark-accent': {
                  navy: '#1E40AF',      // Bright navy
                  blue: '#3B82F6',       // Bright blue
                  teal: '#0891B2',       // Deep teal
                  cyan: '#06B6D4',       // Bright cyan
                  indigo: '#6366F1',    // Bright indigo
                  slate: '#475569',      // Professional slate
                  steel: '#64748B',      // Steel blue
                  ocean: '#0EA5E9',      // Ocean blue
                }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out infinite 2s',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}


