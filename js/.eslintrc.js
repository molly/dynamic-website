export default {
  env: {
    browser: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      { singleQuote: true, tabWidth: 2, useTabs: false },
    ],
  },
};
