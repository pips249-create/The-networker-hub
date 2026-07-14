/** Admin Command Center — Tailwind build (replaces cdn.tailwindcss.com). */
module.exports = {
  content: [
    './admin/**/*.html',
    './js/admin-app.js',
    './js/admin-dashboard.js',
    './js/admin-social-posts.js',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf6fe',
          100: '#ebe0f0',
          200: '#d4c0e0',
          300: '#b89ac8',
          500: '#9a7aa8',
          700: '#5b2f99',
          800: '#3f216b',
          900: '#2d1b4e',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
