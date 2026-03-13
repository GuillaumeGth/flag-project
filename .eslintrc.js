module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['*.ts', '*.tsx', 'node_modules/', 'android/', 'ios/'],
  parserOptions: { ecmaVersion: 2021 },
  overrides: [
    {
      // Config files and mocks — Node.js CommonJS environment
      files: ['*.config.js', '*.setup.js', '__mocks__/**/*.js', '.eslintrc.js'],
      env: { node: true, commonjs: true },
    },
    {
      // Jest setup and test files
      files: ['jest.setup.js', '__tests__/**/*.js', '**/*.test.js'],
      env: { node: true, commonjs: true, jest: true },
    },
  ],
};
