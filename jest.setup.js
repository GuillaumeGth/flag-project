// Override all lazy getters installed by expo/src/winter/runtime.native.ts.
// jest-expo's setup loads that module, which installs lazy getters that capture
// the setup's require() context. When triggered during test execution, those stale
// require() calls throw "You are trying to import a file outside of scope".
// We inspect each property descriptor (without triggering the getter) and replace
// accessor descriptors (lazy getters) with concrete data descriptors.
(function overrideExpoWinterLazyGetters() {
  function replaceLazyGetter(name, value) {
    const desc = Object.getOwnPropertyDescriptor(global, name);
    // Only replace if it's currently an accessor (lazy getter), not a data property
    if (!desc || desc.get) {
      Object.defineProperty(global, name, {
        value: value,
        configurable: true,
        writable: true,
        enumerable: false,
      });
    }
  }

  // Node.js built-ins — get via require to avoid touching potentially-lazy globals
  const { TextDecoder: NodeTextDecoder } = require('util');
  const { URL: NodeURL, URLSearchParams: NodeURLSearchParams } = require('url');

  replaceLazyGetter('TextDecoder', NodeTextDecoder);
  replaceLazyGetter('TextDecoderStream', class TextDecoderStream {});
  replaceLazyGetter('TextEncoderStream', class TextEncoderStream {});
  replaceLazyGetter('URL', NodeURL);
  replaceLazyGetter('URLSearchParams', NodeURLSearchParams);
  replaceLazyGetter('__ExpoImportMetaRegistry', { url: null });
  // structuredClone is Node 17+ built-in; use JSON round-trip as safe fallback
  replaceLazyGetter('structuredClone', (v, _opts) => JSON.parse(JSON.stringify(v)));
})();

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '1.0.0' },
  },
  expoConfig: { version: '1.0.0' },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    High: 6,
    Balanced: 3,
  },
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
}));

// Mock expo-file-system (legacy)
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

// Mock react-native Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Global __DEV__ flag
global.__DEV__ = true;
