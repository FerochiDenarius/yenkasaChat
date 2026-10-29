const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'uploads/**', 'coverage/**', '**/*.min.js'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.commonjs },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-process-exit': 'off',
      'no-console': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      // The existing browser-script syntax test intentionally uses Function.
      'no-new-func': 'off',
    },
  },
];
