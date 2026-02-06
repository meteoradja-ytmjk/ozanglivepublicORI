// Jest setup file - prevent services from auto-starting
jest.mock('../services/streamingService', () => ({}), { virtual: true });
jest.mock('../db/database', () => ({}), { virtual: true });

// Suppress console during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
