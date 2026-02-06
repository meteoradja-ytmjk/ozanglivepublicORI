/**
 * Property-based tests for Stream Key Edit Shortcut
 * Tests stream lookup by stream_key functionality
 */

const fc = require('fast-check');

// Mock database
const mockDb = {
  streams: [],
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn()
};

// Mock the database module
jest.mock('../db/database', () => ({
  db: {
    get: (...args) => mockDb.get(...args),
    run: (...args) => mockDb.run(...args),
    all: (...args) => mockDb.all(...args)
  }
}));

// Import Stream model after mocking
const Stream = require('../models/Stream');

// Arbitrary generators
const streamKeyArb = fc.stringMatching(/^[a-zA-Z0-9\-]{10,50}$/);
const userIdArb = fc.uuid();

// Generator for valid stream data
const streamDataArb = fc.record({
  id: fc.uuid(),
  title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,49}$/),
  video_id: fc.option(fc.uuid(), { nil: null }),
  audio_id: fc.option(fc.uuid(), { nil: null }),
  rtmp_url: fc.constantFrom('rtmp://a.rtmp.youtube.com/live2', 'rtmp://live.twitch.tv/app'),
  stream_key: streamKeyArb,
  platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch'),
  platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch'),
  bitrate: fc.integer({ min: 1000, max: 10000 }),
  resolution: fc.constantFrom('1920x1080', '1280x720'),
  fps: fc.constantFrom(30, 60),
  orientation: fc.constantFrom('horizontal', 'vertical'),
  loop_video: fc.constantFrom(0, 1),
  use_advanced_settings: fc.constantFrom(0, 1),
  recurring_enabled: fc.constantFrom(0, 1),
  schedule_days: fc.option(fc.constant('[]'), { nil: null }),
  user_id: userIdArb,
  video_title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  audio_title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null })
});

describe('Stream Key Edit Shortcut', () => {
  beforeEach(() => {
    mockDb.streams = [];
    jest.clearAllMocks();
  });

  describe('findByStreamKey', () => {
    /**
     * **Feature: streamkey-edit-shortcut, Property 1: Stream Key Lookup Consistency**
     * **Validates: Requirements 1.1, 1.2**
     * 
     * For any stream_key that exists in the database, searching for a stream
     * by that stream_key should return a stream with the exact same stream_key.
     */
    test('Property 1: Stream key lookup returns stream with matching stream_key', async () => {
      await fc.assert(
        fc.asyncProperty(
          streamDataArb,
          async (streamData) => {
            // Setup mock to return the stream when queried
            mockDb.get.mockImplementation((query, params, callback) => {
              if (params[0] === streamData.stream_key && params[1] === streamData.user_id) {
                callback(null, streamData);
              } else {
                callback(null, null);
              }
            });

            // Call findByStreamKey
            const result = await Stream.findByStreamKey(streamData.stream_key, streamData.user_id);

            // Verify the result has the same stream_key
            expect(result).not.toBeNull();
            expect(result.stream_key).toBe(streamData.stream_key);
            expect(result.user_id).toBe(streamData.user_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: streamkey-edit-shortcut, Property 2: Non-existent Stream Key Returns Null**
     * **Validates: Requirements 1.3**
     * 
     * For any stream_key that does not exist in the database, searching for a stream
     * by that stream_key should return null.
     */
    test('Property 2: Non-existent stream key returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          streamKeyArb,
          userIdArb,
          async (streamKey, userId) => {
            // Setup mock to return null (stream not found)
            mockDb.get.mockImplementation((query, params, callback) => {
              callback(null, null);
            });

            // Call findByStreamKey
            const result = await Stream.findByStreamKey(streamKey, userId);

            // Verify the result is null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Unit test: findByStreamKey correctly parses boolean fields
     */
    test('findByStreamKey correctly parses boolean fields from database', async () => {
      const streamData = {
        id: 'test-id',
        stream_key: 'test-stream-key-123',
        user_id: 'test-user-id',
        loop_video: 1,
        use_advanced_settings: 0,
        recurring_enabled: 1,
        schedule_days: '["0","1","2"]'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, streamData);
      });

      const result = await Stream.findByStreamKey('test-stream-key-123', 'test-user-id');

      expect(result.loop_video).toBe(true);
      expect(result.use_advanced_settings).toBe(false);
      expect(result.recurring_enabled).toBe(true);
      expect(Array.isArray(result.schedule_days)).toBe(true);
    });

    /**
     * Unit test: findByStreamKey handles database errors
     */
    test('findByStreamKey rejects on database error', async () => {
      const dbError = new Error('Database connection failed');
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(dbError, null);
      });

      await expect(Stream.findByStreamKey('any-key', 'any-user'))
        .rejects.toThrow('Database connection failed');
    });
  });
});
