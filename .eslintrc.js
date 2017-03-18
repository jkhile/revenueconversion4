module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  env: {
    node: true,
    commonjs: true,
    es6: true
  },
  plugins: [
    'node'
  ],
  rules: {
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    curly: ['error', 'all'],
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'no-console': 'off',
    'node/no-unsupported-features': ['error', { version: 7, ignores: ['asyncAwait'] }],
    'node/no-unpublished-require': ['error', { 'allowModules': ['tap'] }]
  }
};
