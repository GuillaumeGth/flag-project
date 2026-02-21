// Mock expo/src/winter/runtime.native to prevent import.meta errors in Jest
// The real module installs global polyfills (TextDecoder, URL, etc.) via lazy getters
// that try to dynamically require modules outside of Jest's module scope.
module.exports = {};
