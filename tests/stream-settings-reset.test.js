/**
 * Property-based tests for Stream Settings Reset functionality
 * Tests reset to original imported settings
 */

const fc = require('fast-check');

// Mock database
const mockDb = {
  streams: [],
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../db/database', () => ({
  db: mockDb
}));

// Import after mocking
const Stream = require('../models/Stream');

// Generator for original settings
const originalSettingsArb = fc.record({
  schedule_time: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  recurring_time: fc.option(
    fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    { nil: null }
  ),
  stream_duration_minutes: fc.option(fc.integer({ min: 1, max: 10080 }), { nil: null }),
  schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
  schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
  recurring_enabled: fc.boolean()
});

// Generator for stream with original settings
const streamWithOriginalArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  original_settings: originalSettingsArb.map(os => JSON.stringify(os))
});

// Generator for stream without original settings
const streamWithoutOriginalArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  original_settings: fc.constant(null)
});

describe('Stream Settings Reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.streams = [];
  });

  describe('resetToOriginal', () => {
    /**
     * **Feature: stream-settings-reset, Property 2: Reset restores original values (Round-trip)**
     * **Validates: Requirements 1.2, 1.3**
     */
    test('Property 2: Reset restores original values to stream', async () => {
      await fc.assert(
        fc.asyncProperty(
          streamWithOriginalArb,
          async (stream) => {
            const originalSettings = JSON.parse(stream.original_settings);
            let updatedValues = null;

            // Mock db.get to return the stream
            mockDb.get.mockImplementation((query, params, callback) => {
              callback(null, stream);
            });

            // Mock db.run to capture the update
            mockDb.run.mockImplementation(function(query, params, callback) {
              if (query.includes('UPDATE streams SET')) {
                updatedValues = {
                  schedule_time: params[0],
                  recurring_time: params[1],
                  stream_duration_minutes: params[2],
                  schedule_type: params[3],
                  schedule_days: params[4] ? JSON.parse(params[4]) : null,
                  recurring_enabled: params[5] === 1
                };
                callback.call({ changes: 1 }, null);
              } else {
                callback.call({ changes: 0 }, null);
              }
            });

            const result = await Stream.resetToOriginal(stream.id, stream.user_id);

            // Verify reset was successful
            expect(result.success).toBe(true);
            expect(result.reset).toBe(true);

            // Verify updated values match original settings
            expect(updatedValues.schedule_time).toBe(originalSettings.schedule_time);
            expect(updatedValues.recurring_time).toBe(originalSettings.recurring_time);
            expect(updatedValues.stream_duration_minutes).toBe(originalSettings.stream_duration_minutes);
            expect(updatedValues.schedule_type).toBe(originalSettings.schedule_type);
            expect(updatedValues.recurring_enabled).toBe(originalSettings.recurring_enabled !== false);
            
            // Handle schedule_days comparison (both could be null or arrays)
            if (originalSettings.schedule_days === null) {
              expect(updatedValues.schedule_days).toBeNull();
            } else {
              expect(updatedValues.schedule_days).toEqual(originalSettings.schedule_days);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Skips stream without original settings', async () => {
      await fc.assert(
        fc.asyncProperty(
          streamWithoutOriginalArb,
          async (stream) => {
            // Mock db.get to return stream without original_settings
            mockDb.get.mockImplementation((query, params, callback) => {
              callback(null, stream);
            });

            const result = await Stream.resetToOriginal(stream.id, stream.user_id);

            // Verify stream was skipped (not reset)
            expect(result.success).toBe(true);
            expect(result.reset).toBe(false);
            expect(result.reason).toBe('No original settings');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('resetAllToOriginal', () => {
    /**
     * **Feature: stream-settings-reset, Property 3: Reset count accuracy**
     * **Validates: Requirements 1.4, 1.5**
     */
    test('Property 3: Reset count matches streams with original settings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(streamWithOriginalArb, streamWithoutOriginalArb),
            { minLength: 0, maxLength: 10 }
          ),
          fc.uuid(),
          async (streams, userId) => {
            // Assign same user_id to all streams
            const userStreams = streams.map(s => ({ ...s, user_id: userId }));
            
            // Count streams with original settings
            const streamsWithOriginal = userStreams.filter(s => s.original_settings !== null);
            const streamsWithoutOriginal = userStreams.filter(s => s.original_settings === null);

            // Mock db.all to return all streams
            mockDb.all.mockImplementation((query, params, callback) => {
              callback(null, userStreams);
            });

            // Track which streams get reset
            let resetCount = 0;
            let skipCount = 0;

            // Mock db.get for individual stream lookups
            mockDb.get.mockImplementation((query, params, callback) => {
              const stream = userStreams.find(s => s.id === params[0]);
              callback(null, stream);
            });

            // Mock db.run for updates
            mockDb.run.mockImplementation(function(query, params, callback) {
              if (query.includes('UPDATE streams SET')) {
                callback.call({ changes: 1 }, null);
              } else {
                callback.call({ changes: 0 }, null);
              }
            });

            const result = await Stream.resetAllToOriginal(userId);

            // Verify counts
            expect(result.resetCount).toBe(streamsWithOriginal.length);
            expect(result.skippedCount).toBe(streamsWithoutOriginal.length);
            expect(result.resetCount + result.skippedCount).toBe(userStreams.length);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
