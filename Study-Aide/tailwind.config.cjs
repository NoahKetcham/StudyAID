module.exports = {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          // your primary color codes
          100: '#A7DAD8',
          200: '#8CA6DB',
          300: '#B6CDBD',
          400: '#F4D160'
        },
        secondary: {
          100: '#C3B1E1',
          200: '#E0E4E8',
          300: '#4A5568'
        }
      }
    }
  },
  plugins: []
} 