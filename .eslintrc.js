module.exports = {
  extends: 'eslint:recommended',
  plugins: ['prettier'],
  rules: {
    //https://stackoverflow.com/a/53769213
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
      modules: true,
    },
    ecmaVersion: 2020,
    sourceType: 'module',
    useJSXTextNode: true,
  },
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
    commonjs: true,
  },
  globals: {
    $: true,
  },
};
