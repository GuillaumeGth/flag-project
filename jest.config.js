module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Prevent expo winter runtime from crashing Jest's module sandbox
    '^expo/src/winter/runtime\\.native$': '<rootDir>/__mocks__/expo-winter-runtime.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|base64-arraybuffer)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/contexts/**/*.tsx',
    '!src/**/*.d.ts',
  ],
};
