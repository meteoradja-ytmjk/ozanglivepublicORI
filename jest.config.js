module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: false,
  testMatch: ['**/tests/**/*.test.js'],
  modulePathIgnorePatterns: ['<rootDir>/services/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
