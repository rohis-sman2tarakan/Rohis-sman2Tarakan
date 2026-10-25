module.exports = {
  content: ['./*.html', './kelola/*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        forest: '#244632',
        leaf: '#356947',
        sage: '#78917A',
        mist: '#E7EEE2',
        ivory: '#F5F2E8',
        charcoal: '#202A25',
        muted: '#53645A',
        line: '#D8E0D4',
        surface: '#EDF1E8',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
