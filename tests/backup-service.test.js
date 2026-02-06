/**
 * Property-based tests for Backup Service
 * Tests export and import functionality for stream settings
 */

const fc = require('fast-check');

// Mock the Stream model and database
const mockStreams = [];
let mockCreateCalls = [];

jest.mock('../models/Stream', () => ({
  findAll: jest.fn(async (userId) => {
    return mockStreams.filter(s => s.user_id === userId);
  }),
  create: jest.fn(async (streamData) => {
    mockCreateCalls.push(streamData);
    return { id: 'mock-id', ...streamData };
  })
}));

const {
  exportStreams,
  importStreams,
  validateBackupFormat,
  validateStreamConfig,
  determineImportStatus,
  EXPORT_FIELDS,
  REQUIRED_FIELDS,
  EXCLUDED_FIELDS
} = require('../services/backupService');

// Helper to create valid date arbitrary
const validDateStringArb = fc.constantFrom(
  '2024-01-15T10:00:00.000Z',
  '2024-06-20T14:30:00.000Z',
  '2025-03-10T08:00:00.000Z',
  '2025-12-25T18:00:00.000Z'
);

// Arbitrary generators for stream configurations
const streamConfigArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  video_id: fc.option(fc.uuid(), { nil: null }),
  audio_id: fc.option(fc.uuid(), { nil: null }),
  title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,99}$/),
  rtmp_url: fc.webUrl(),
  stream_key: fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/),
  platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch', 'TikTok'),
  platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch', 'tiktok'),
  bitrate: fc.integer({ min: 1000, max: 10000 }),
  resolution: fc.constantFrom('1920x1080', '1280x720', '854x480'),
  fps: fc.constantFrom(24, 30, 60),
  orientation: fc.constantFrom('horizontal', 'vertical'),
  loop_video: fc.boolean(),
  schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
  schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
  recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
  recurring_enabled: fc.boolean(),
  stream_duration_hours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: null }),
  status: fc.constantFrom('live', 'offline', 'scheduled'),
  status_updated_at: validDateStringArb,
  start_time: fc.option(validDateStringArb, { nil: null }),
  end_time: fc.option(validDateStringArb, { nil: null }),
  schedule_time: fc.option(validDateStringArb, { nil: null }),
  duration: fc.option(fc.integer({ min: 0, max: 86400 }), { nil: null }),
  created_at: validDateStringArb,
  updated_at: validDateStringArb
});

// Generator for valid export stream config (only export fields)
const validExportStreamArb = fc.record({
  title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,99}$/),
  rtmp_url: fc.webUrl(),
  stream_key: fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/),
  platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch'),
  platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch'),
  bitrate: fc.integer({ min: 1000, max: 10000 }),
  resolution: fc.constantFrom('1920x1080', '1280x720'),
  fps: fc.constantFrom(30, 60),
  orientation: fc.constantFrom('horizontal', 'vertical'),
  loop_video: fc.boolean(),
  schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
  schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 })), { nil: null }),
  recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
  recurring_enabled: fc.boolean(),
  stream_duration_hours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: null })
});

describe('Backup Service', () => {
  beforeEach(() => {
    mockStreams.length = 0;
    mockCreateCalls = [];
    jest.clearAllMocks();
  });

  describe('exportStreams', () => {
    /**
     * **Feature: stream-settings-backup, Property 1: Export produces complete stream data**
     * **Validates: Requirements 1.1, 1.2**
     */
    test('Property 1: Export produces complete stream data with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(streamConfigArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (streams, userId) => {
            // Setup mock data
            mockStreams.length = 0;
            streams.forEach(s => {
              mockStreams.push({ ...s, user_id: userId });
            });

            const result = await exportStreams(userId);

            // Verify metadata exists
            expect(result.metadata).toBeDefined();
            expect(result.metadata.exportDate).toBeDefined();
            expect(result.metadata.appVersion).toBeDefined();
            expect(result.metadata.totalStreams).toBe(streams.length);

            // Verify streams array exists
            expect(Array.isArray(result.streams)).toBe(true);
            expect(result.streams.length).toBe(streams.length);

            // Verify each exported stream has the expected fields
            result.streams.forEach((exportedStream, index) => {
              const originalStream = streams[index];
              
              // Check that export fields are present when they exist in original
              EXPORT_FIELDS.forEach(field => {
                if (originalStream[field] !== undefined) {
                  expect(exportedStream[field]).toBe(originalStream[field]);
                }
              });
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: backup-import-fix, Property 1: Export Completeness**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     */
    test('Property 1: Export includes all configuration fields with exact values', async () => {
      // Generator with all fields including new ones
      const completeStreamArb = fc.record({
        id: fc.uuid(),
        user_id: fc.uuid(),
        video_id: fc.option(fc.uuid(), { nil: null }),
        audio_id: fc.option(fc.uuid(), { nil: null }),
        title: fc.string({ minLength: 1, maxLength: 100 }),
        rtmp_url: fc.webUrl(),
        stream_key: fc.string({ minLength: 10, maxLength: 50 }),
        platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch'),
        platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch'),
        bitrate: fc.integer({ min: 1000, max: 10000 }),
        resolution: fc.constantFrom('1920x1080', '1280x720'),
        fps: fc.constantFrom(30, 60),
        orientation: fc.constantFrom('horizontal', 'vertical'),
        loop_video: fc.boolean(),
        schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
        schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
        schedule_time: fc.option(validDateStringArb, { nil: null }),
        recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00'), { nil: null }),
        recurring_enabled: fc.boolean(),
        stream_duration_hours: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
        stream_duration_minutes: fc.option(fc.integer({ min: 30, max: 480 }), { nil: null }),
        status: fc.constantFrom('live', 'offline', 'scheduled'),
        created_at: validDateStringArb,
        updated_at: validDateStringArb
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(completeStreamArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (streams, userId) => {
            // Setup mock data
            mockStreams.length = 0;
            streams.forEach(s => {
              mockStreams.push({ ...s, user_id: userId });
            });

            const result = await exportStreams(userId);

            // Verify each exported stream has all EXPORT_FIELDS with exact values
            result.streams.forEach((exportedStream, index) => {
              const originalStream = streams[index];
              
              // Check that all export fields are present with exact values
              EXPORT_FIELDS.forEach(field => {
                if (originalStream[field] !== undefined) {
                  // Use toEqual for schedule_days since it's an array
                  if (field === 'schedule_days') {
                    expect(exportedStream[field]).toEqual(originalStream[field]);
                  } else {
                    expect(exportedStream[field]).toBe(originalStream[field]);
                  }
                }
              });
              
              // Specifically verify new fields are included
              if (originalStream.schedule_time !== undefined) {
                expect(exportedStream.schedule_time).toBe(originalStream.schedule_time);
              }
              if (originalStream.stream_duration_minutes !== undefined) {
                expect(exportedStream.stream_duration_minutes).toBe(originalStream.stream_duration_minutes);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: stream-settings-backup, Property 2: Export excludes sensitive fields**
     * **Validates: Requirements 1.3**
     */
    test('Property 2: Export excludes sensitive fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(streamConfigArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (streams, userId) => {
            // Setup mock data
            mockStreams.length = 0;
            streams.forEach(s => {
              mockStreams.push({ ...s, user_id: userId });
            });

            const result = await exportStreams(userId);

            // Verify no excluded fields are present in any exported stream
            result.streams.forEach(exportedStream => {
              EXCLUDED_FIELDS.forEach(field => {
                expect(exportedStream[field]).toBeUndefined();
              });
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('validateBackupFormat', () => {
    test('validates correct backup format', () => {
      const validBackup = {
        metadata: { exportDate: new Date().toISOString() },
        streams: []
      };
      const result = validateBackupFormat(validBackup);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects backup without streams array', () => {
      const invalidBackup = { metadata: {} };
      const result = validateBackupFormat(invalidBackup);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid backup format: missing streams array');
    });

    test('accepts backup without metadata (backward compatibility)', () => {
      const backupWithoutMetadata = { streams: [] };
      const result = validateBackupFormat(backupWithoutMetadata);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateStreamConfig', () => {
    test('validates complete stream config', () => {
      const validConfig = {
        title: 'Test Stream',
        rtmp_url: 'rtmp://example.com/live',
        stream_key: 'test-key-12345'
      };
      const result = validateStreamConfig(validConfig);
      expect(result.valid).toBe(true);
    });

    test('rejects config missing title', () => {
      const invalidConfig = {
        rtmp_url: 'rtmp://example.com/live',
        stream_key: 'test-key-12345'
      };
      const result = validateStreamConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: title');
    });

    test('rejects config missing rtmp_url', () => {
      const invalidConfig = {
        title: 'Test Stream',
        stream_key: 'test-key-12345'
      };
      const result = validateStreamConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: rtmp_url');
    });

    test('rejects config missing stream_key', () => {
      const invalidConfig = {
        title: 'Test Stream',
        rtmp_url: 'rtmp://example.com/live'
      };
      const result = validateStreamConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: stream_key');
    });
  });

  describe('determineImportStatus', () => {
    /**
     * **Feature: backup-import-fix, Property 2: Import Status Determination**
     * **Validates: Requirements 2.1, 2.2, 4.1, 4.2, 4.3**
     */
    test('Property 2: Import status is determined correctly based on schedule configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1 }),
            rtmp_url: fc.webUrl(),
            stream_key: fc.string({ minLength: 10 }),
            schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
            schedule_time: fc.option(validDateStringArb, { nil: null }),
            recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
            recurring_enabled: fc.boolean()
          }),
          (streamConfig) => {
            const status = determineImportStatus(streamConfig);
            
            // Daily or weekly schedules should be 'scheduled'
            if (streamConfig.schedule_type === 'daily' || streamConfig.schedule_type === 'weekly') {
              expect(status).toBe('scheduled');
              return;
            }
            
            // One-time schedule with schedule_time should be 'scheduled'
            if (streamConfig.schedule_time) {
              expect(status).toBe('scheduled');
              return;
            }
            
            // Otherwise should be 'offline'
            expect(status).toBe('offline');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('daily schedule type returns scheduled status', () => {
      const config = { schedule_type: 'daily', title: 'Test', rtmp_url: 'rtmp://test', stream_key: 'key123' };
      expect(determineImportStatus(config)).toBe('scheduled');
    });

    test('weekly schedule type returns scheduled status', () => {
      const config = { schedule_type: 'weekly', title: 'Test', rtmp_url: 'rtmp://test', stream_key: 'key123' };
      expect(determineImportStatus(config)).toBe('scheduled');
    });

    test('once schedule type with schedule_time returns scheduled status', () => {
      const config = { schedule_type: 'once', schedule_time: '2025-12-15T10:00:00Z', title: 'Test', rtmp_url: 'rtmp://test', stream_key: 'key123' };
      expect(determineImportStatus(config)).toBe('scheduled');
    });

    test('once schedule type without schedule_time returns offline status', () => {
      const config = { schedule_type: 'once', title: 'Test', rtmp_url: 'rtmp://test', stream_key: 'key123' };
      expect(determineImportStatus(config)).toBe('offline');
    });

    test('no schedule_type defaults to offline', () => {
      const config = { title: 'Test', rtmp_url: 'rtmp://test', stream_key: 'key123' };
      expect(determineImportStatus(config)).toBe('offline');
    });
  });

  describe('importStreams', () => {
    /**
     * **Feature: stream-settings-backup, Property 3: Import validates required fields**
     * **Validates: Requirements 2.2, 2.4**
     */
    test('Property 3: Import skips entries missing required fields and continues', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              rtmp_url: fc.option(fc.webUrl(), { nil: undefined }),
              stream_key: fc.option(fc.string({ minLength: 10 }), { nil: undefined }),
              platform: fc.constant('YouTube')
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.uuid(),
          async (streamConfigs, userId) => {
            mockCreateCalls = [];
            
            const backupData = { streams: streamConfigs };
            const result = await importStreams(backupData, userId);

            // Count valid configs (those with all required fields)
            const validConfigs = streamConfigs.filter(config => 
              config.title && config.rtmp_url && config.stream_key
            );
            const invalidConfigs = streamConfigs.length - validConfigs.length;

            // Verify counts match
            expect(result.imported).toBe(validConfigs.length);
            expect(result.skipped).toBe(invalidConfigs);
            expect(result.imported + result.skipped).toBe(streamConfigs.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: stream-settings-backup, Property 4: Import returns accurate counts**
     * **Validates: Requirements 2.3, 2.5**
     */
    test('Property 4: Import returns accurate counts matching actual operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validExportStreamArb, { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          async (validStreams, userId) => {
            mockCreateCalls = [];
            
            const backupData = { streams: validStreams };
            const result = await importStreams(backupData, userId);

            // All valid streams should be imported
            expect(result.imported).toBe(validStreams.length);
            expect(result.skipped).toBe(0);
            
            // Verify actual create calls match imported count
            expect(mockCreateCalls.length).toBe(result.imported);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: stream-settings-backup, Property 5: Import accepts files with or without metadata**
     * **Validates: Requirements 4.3**
     */
    test('Property 5: Import accepts files with or without metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validExportStreamArb, { minLength: 1, maxLength: 5 }),
          fc.boolean(),
          fc.uuid(),
          async (streams, includeMetadata, userId) => {
            mockCreateCalls = [];
            
            const backupData = includeMetadata 
              ? { 
                  metadata: { 
                    exportDate: new Date().toISOString(),
                    appVersion: '1.0.0',
                    totalStreams: streams.length 
                  }, 
                  streams 
                }
              : { streams };

            const result = await importStreams(backupData, userId);

            // Import should succeed regardless of metadata presence
            expect(result.imported).toBe(streams.length);
            expect(result.skipped).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: stream-settings-reset, Property 1: Import preserves original settings**
     * **Validates: Requirements 1.1**
     */
    test('Property 1: Import stores original settings for each stream', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validExportStreamArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (streams, userId) => {
            mockCreateCalls = [];
            
            const backupData = { streams };
            await importStreams(backupData, userId);

            // Verify each created stream has original_settings
            mockCreateCalls.forEach((createdStream, index) => {
              const original = streams[index];
              
              // Verify original_settings exists
              expect(createdStream.original_settings).toBeDefined();
              expect(createdStream.original_settings).not.toBeNull();
              
              // Verify original_settings contains correct values
              const originalSettings = createdStream.original_settings;
              expect(originalSettings.schedule_type).toBe(original.schedule_type);
              
              // Empty strings are converted to null for recurring_time
              const expectedRecurringTime = original.recurring_time || null;
              expect(originalSettings.recurring_time).toBe(expectedRecurringTime);
              
              expect(originalSettings.recurring_enabled).toBe(original.recurring_enabled);
              expect(originalSettings.schedule_days).toEqual(original.schedule_days);
              
              // Handle duration conversion (hours to minutes)
              const expectedMinutes = original.stream_duration_minutes || 
                (original.stream_duration_hours ? original.stream_duration_hours * 60 : null);
              expect(originalSettings.stream_duration_minutes).toBe(expectedMinutes);
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    /**
     * **Feature: backup-import-fix, Property 3: Import Field Preservation**
     * **Validates: Requirements 2.3, 2.4, 3.2, 3.3**
     */
    test('Property 3: Import preserves all configuration fields correctly', async () => {
      // Generator with all fields including schedule_time and stream_duration_minutes
      // Use valid non-whitespace title and stream_key
      const fullStreamConfigArb = fc.record({
        title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,99}$/),
        rtmp_url: fc.webUrl(),
        stream_key: fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/),
        platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch'),
        platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch'),
        bitrate: fc.integer({ min: 1000, max: 10000 }),
        resolution: fc.constantFrom('1920x1080', '1280x720'),
        fps: fc.constantFrom(30, 60),
        orientation: fc.constantFrom('horizontal', 'vertical'),
        loop_video: fc.boolean(),
        schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
        schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
        schedule_time: fc.option(validDateStringArb, { nil: null }),
        recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
        recurring_enabled: fc.boolean(),
        stream_duration_minutes: fc.option(fc.integer({ min: 30, max: 480 }), { nil: null }),
        stream_duration_hours: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null })
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(fullStreamConfigArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (streams, userId) => {
            mockCreateCalls = [];
            
            const backupData = { streams };
            await importStreams(backupData, userId);

            // Verify each created stream has fields preserved
            mockCreateCalls.forEach((createdStream, index) => {
              const original = streams[index];
              
              // Verify schedule_time is preserved
              expect(createdStream.schedule_time).toBe(original.schedule_time || null);
              
              // Verify schedule_days is preserved
              expect(createdStream.schedule_days).toEqual(original.schedule_days || null);
              
              // Verify recurring_time is preserved
              expect(createdStream.recurring_time).toBe(original.recurring_time || null);
              
              // Verify recurring_enabled is preserved
              expect(createdStream.recurring_enabled).toBe(original.recurring_enabled !== false);
              
              // Verify stream_duration_minutes is correctly handled
              const expectedMinutes = original.stream_duration_minutes || 
                (original.stream_duration_hours ? original.stream_duration_hours * 60 : null);
              expect(createdStream.stream_duration_minutes).toBe(expectedMinutes);
              
              // Verify status is determined correctly
              const expectedStatus = (original.schedule_type === 'daily' || original.schedule_type === 'weekly' || original.schedule_time) 
                ? 'scheduled' 
                : 'offline';
              expect(createdStream.status).toBe(expectedStatus);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: backup-import-fix, Property 4: Round-trip Consistency**
   * **Validates: Requirements 3.1**
   */
  describe('Round-trip', () => {
    test('Property 4: Export then import produces equivalent stream configurations with correct status', async () => {
      // Generator with all fields including new ones
      // Use stringMatching to ensure non-whitespace title
      const fullStreamArb = fc.record({
        title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,99}$/),
        rtmp_url: fc.webUrl(),
        stream_key: fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/),
        platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch'),
        platform_icon: fc.constantFrom('youtube', 'facebook', 'twitch'),
        bitrate: fc.integer({ min: 1000, max: 10000 }),
        resolution: fc.constantFrom('1920x1080', '1280x720'),
        fps: fc.constantFrom(30, 60),
        orientation: fc.constantFrom('horizontal', 'vertical'),
        loop_video: fc.boolean(),
        schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
        schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
        schedule_time: fc.option(validDateStringArb, { nil: null }),
        recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00'), { nil: null }),
        recurring_enabled: fc.boolean(),
        stream_duration_hours: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
        stream_duration_minutes: fc.option(fc.integer({ min: 30, max: 480 }), { nil: null })
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(fullStreamArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.uuid(),
          async (originalStreams, exportUserId, importUserId) => {
            // Setup: Add streams to mock for export
            mockStreams.length = 0;
            originalStreams.forEach((stream, index) => {
              mockStreams.push({
                ...stream,
                id: `stream-${index}`,
                user_id: exportUserId,
                video_id: null,
                audio_id: null,
                status: 'offline',
                status_updated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            });

            // Export
            const exportedData = await exportStreams(exportUserId);

            // Reset for import
            mockCreateCalls = [];

            // Import
            const importResult = await importStreams(exportedData, importUserId);

            // Verify all streams were imported
            expect(importResult.imported).toBe(originalStreams.length);
            expect(importResult.skipped).toBe(0);

            // Verify imported streams have equivalent configuration values
            mockCreateCalls.forEach((createdStream, index) => {
              const original = originalStreams[index];
              
              // Check that key configuration fields match
              expect(createdStream.title).toBe(original.title);
              expect(createdStream.rtmp_url).toBe(original.rtmp_url);
              expect(createdStream.stream_key).toBe(original.stream_key);
              expect(createdStream.platform).toBe(original.platform);
              expect(createdStream.bitrate).toBe(original.bitrate);
              expect(createdStream.resolution).toBe(original.resolution);
              expect(createdStream.fps).toBe(original.fps);
              expect(createdStream.orientation).toBe(original.orientation);
              expect(createdStream.loop_video).toBe(original.loop_video);
              expect(createdStream.schedule_type).toBe(original.schedule_type);
              
              // Verify new fields are preserved
              expect(createdStream.schedule_time).toBe(original.schedule_time || null);
              expect(createdStream.recurring_time).toBe(original.recurring_time || null);
              expect(createdStream.recurring_enabled).toBe(original.recurring_enabled !== false);
              expect(createdStream.schedule_days).toEqual(original.schedule_days || null);
              
              // Verify stream_duration_minutes is correctly handled
              const expectedMinutes = original.stream_duration_minutes || 
                (original.stream_duration_hours ? original.stream_duration_hours * 60 : null);
              expect(createdStream.stream_duration_minutes).toBe(expectedMinutes);
              
              // Verify status is determined correctly based on schedule
              const expectedStatus = (original.schedule_type === 'daily' || original.schedule_type === 'weekly' || original.schedule_time) 
                ? 'scheduled' 
                : 'offline';
              expect(createdStream.status).toBe(expectedStatus);
              
              // Verify imported stream belongs to import user
              expect(createdStream.user_id).toBe(importUserId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
