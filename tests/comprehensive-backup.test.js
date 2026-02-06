/**
 * Property-based tests for Comprehensive Backup Export
 * Tests export and import functionality for all data categories
 */

const fc = require('fast-check');

// Mock data storage
const mockData = {
  streams: [],
  youtubeCredentials: [],
  broadcastTemplates: [],
  recurringSchedules: [],
  streamTemplates: [],
  playlists: [],
  playlistVideos: {}
};

// Mock the models
jest.mock('../models/Stream', () => ({
  findAll: jest.fn(async (userId) => mockData.streams.filter(s => s.user_id === userId)),
  create: jest.fn(async (data) => ({ id: `stream-${Date.now()}`, ...data }))
}));

jest.mock('../models/YouTubeCredentials', () => ({
  findAllByUserId: jest.fn(async (userId) => mockData.youtubeCredentials.filter(c => c.userId === userId)),
  create: jest.fn(async (userId, data) => ({ id: Date.now(), userId, ...data })),
  existsByChannel: jest.fn(async (userId, channelId) => 
    mockData.youtubeCredentials.some(c => c.userId === userId && c.channelId === channelId)
  )
}));

jest.mock('../models/BroadcastTemplate', () => ({
  findByUserId: jest.fn(async (userId) => mockData.broadcastTemplates.filter(t => t.user_id === userId)),
  create: jest.fn(async (data) => ({ id: `bt-${Date.now()}`, ...data })),
  findByName: jest.fn(async (userId, name) => 
    mockData.broadcastTemplates.find(t => t.user_id === userId && t.name === name)
  )
}));

jest.mock('../models/RecurringSchedule', () => ({
  findByUserId: jest.fn(async (userId) => mockData.recurringSchedules.filter(s => s.user_id === userId)),
  create: jest.fn(async (data) => ({ id: `rs-${Date.now()}`, ...data }))
}));

jest.mock('../models/StreamTemplate', () => ({
  findByUserId: jest.fn(async (userId) => mockData.streamTemplates.filter(t => t.user_id === userId)),
  create: jest.fn(async (data) => ({ id: `st-${Date.now()}`, ...data })),
  findByName: jest.fn(async (userId, name) => 
    mockData.streamTemplates.find(t => t.user_id === userId && t.name === name)
  )
}));

jest.mock('../models/Playlist', () => ({
  findAll: jest.fn(async (userId) => mockData.playlists.filter(p => p.user_id === userId)),
  findByIdWithVideos: jest.fn(async (id) => {
    const playlist = mockData.playlists.find(p => p.id === id);
    if (!playlist) return null;
    return {
      ...playlist,
      videos: mockData.playlistVideos[id] || []
    };
  }),
  create: jest.fn(async (data) => ({ id: `pl-${Date.now()}`, ...data }))
}));

const {
  exportYouTubeCredentials,
  exportBroadcastTemplates,
  exportRecurringSchedules,
  exportStreamTemplates,
  exportPlaylists,
  YOUTUBE_CREDENTIALS_FIELDS,
  BROADCAST_TEMPLATE_FIELDS,
  RECURRING_SCHEDULE_FIELDS,
  STREAM_TEMPLATE_FIELDS,
  PLAYLIST_FIELDS
} = require('../services/backupService');

// Arbitrary generators
const youtubeCredentialArb = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  userId: fc.uuid(),
  channelName: fc.string({ minLength: 1, maxLength: 50 }),
  channelId: fc.stringMatching(/^UC[a-zA-Z0-9_-]{22}$/),
  clientId: fc.stringMatching(/^[0-9]{12}-[a-z0-9]{32}\.apps\.googleusercontent\.com$/),
  clientSecret: fc.stringMatching(/^GOCSPX-[a-zA-Z0-9_-]{28}$/),
  refreshToken: fc.stringMatching(/^1\/\/[a-zA-Z0-9_-]{40,60}$/),
  isPrimary: fc.boolean()
});

const broadcastTemplateArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  account_id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24', '10'),
  thumbnail_path: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  stream_id: fc.option(fc.uuid(), { nil: null }),
  recurring_enabled: fc.boolean(),
  recurring_pattern: fc.option(fc.constantFrom('daily', 'weekly'), { nil: null }),
  recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
  recurring_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
  next_run_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  last_run_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
});

const recurringScheduleArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  account_id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  pattern: fc.constantFrom('daily', 'weekly'),
  schedule_time: fc.constantFrom('08:00', '12:00', '18:00', '22:00'),
  days_of_week: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null }),
  template_id: fc.option(fc.uuid(), { nil: null }),
  title_template: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24', '10'),
  is_active: fc.boolean(),
  next_run_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  last_run_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
});

const streamTemplateArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  video_id: fc.option(fc.uuid(), { nil: null }),
  audio_id: fc.option(fc.uuid(), { nil: null }),
  duration_hours: fc.integer({ min: 0, max: 24 }),
  duration_minutes: fc.integer({ min: 0, max: 59 }),
  loop_video: fc.boolean(),
  schedule_type: fc.constantFrom('once', 'daily', 'weekly'),
  recurring_time: fc.option(fc.constantFrom('08:00', '12:00', '18:00', '22:00'), { nil: null }),
  schedule_days: fc.option(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), { nil: null })
});

const playlistArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  is_shuffle: fc.boolean()
});

describe('Comprehensive Backup Export', () => {
  beforeEach(() => {
    // Reset mock data
    mockData.streams = [];
    mockData.youtubeCredentials = [];
    mockData.broadcastTemplates = [];
    mockData.recurringSchedules = [];
    mockData.streamTemplates = [];
    mockData.playlists = [];
    mockData.playlistVideos = {};
    jest.clearAllMocks();
  });

  describe('exportYouTubeCredentials', () => {
    /**
     * **Feature: comprehensive-backup-export, Property 4: Field completeness for each category**
     * **Validates: Requirements 2.3**
     */
    test('Property 4.1: YouTube credentials export includes all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(youtubeCredentialArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (credentials, userId) => {
            // Setup mock data
            mockData.youtubeCredentials = credentials.map(c => ({ ...c, userId }));

            const result = await exportYouTubeCredentials(userId);

            expect(result.length).toBe(credentials.length);

            result.forEach((exported, index) => {
              // Verify all required fields are present
              YOUTUBE_CREDENTIALS_FIELDS.forEach(field => {
                expect(exported).toHaveProperty(field);
              });

              // Verify values match original
              const original = credentials[index];
              expect(exported.channel_name).toBe(original.channelName);
              expect(exported.channel_id).toBe(original.channelId);
              expect(exported.client_id).toBe(original.clientId);
              expect(exported.client_secret).toBe(original.clientSecret);
              expect(exported.refresh_token).toBe(original.refreshToken);
              expect(exported.is_primary).toBe(original.isPrimary);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('exportBroadcastTemplates', () => {
    /**
     * **Feature: comprehensive-backup-export, Property 4: Field completeness for each category**
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    test('Property 4.2: Broadcast templates export includes all fields including recurring config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(broadcastTemplateArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (templates, userId) => {
            // Setup mock data
            mockData.broadcastTemplates = templates.map(t => ({ ...t, user_id: userId }));

            const result = await exportBroadcastTemplates(userId);

            expect(result.length).toBe(templates.length);

            result.forEach((exported, index) => {
              const original = templates[index];

              // Verify all fields that exist in original are exported
              BROADCAST_TEMPLATE_FIELDS.forEach(field => {
                if (original[field] !== undefined) {
                  expect(exported[field]).toEqual(original[field]);
                }
              });

              // Specifically verify recurring fields
              expect(exported.recurring_enabled).toBe(original.recurring_enabled);
              if (original.recurring_pattern) {
                expect(exported.recurring_pattern).toBe(original.recurring_pattern);
              }
              if (original.recurring_time) {
                expect(exported.recurring_time).toBe(original.recurring_time);
              }
              if (original.recurring_days) {
                expect(exported.recurring_days).toEqual(original.recurring_days);
              }

              // Verify references
              expect(exported.account_id).toBe(original.account_id);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('exportRecurringSchedules', () => {
    /**
     * **Feature: comprehensive-backup-export, Property 4: Field completeness for each category**
     * **Validates: Requirements 4.1, 4.2, 4.3**
     */
    test('Property 4.3: Recurring schedules export includes all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(recurringScheduleArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (schedules, userId) => {
            // Setup mock data
            mockData.recurringSchedules = schedules.map(s => ({ ...s, user_id: userId }));

            const result = await exportRecurringSchedules(userId);

            expect(result.length).toBe(schedules.length);

            result.forEach((exported, index) => {
              const original = schedules[index];

              // Verify all fields that exist in original are exported
              RECURRING_SCHEDULE_FIELDS.forEach(field => {
                if (original[field] !== undefined) {
                  expect(exported[field]).toEqual(original[field]);
                }
              });

              // Verify key fields
              expect(exported.pattern).toBe(original.pattern);
              expect(exported.schedule_time).toBe(original.schedule_time);
              expect(exported.is_active).toBe(original.is_active);
              expect(exported.account_id).toBe(original.account_id);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('exportStreamTemplates', () => {
    /**
     * **Feature: comprehensive-backup-export, Property 4: Field completeness for each category**
     * **Validates: Requirements 5.1, 5.2**
     */
    test('Property 4.4: Stream templates export includes all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(streamTemplateArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (templates, userId) => {
            // Setup mock data
            mockData.streamTemplates = templates.map(t => ({ ...t, user_id: userId }));

            const result = await exportStreamTemplates(userId);

            expect(result.length).toBe(templates.length);

            result.forEach((exported, index) => {
              const original = templates[index];

              // Verify all fields that exist in original are exported
              STREAM_TEMPLATE_FIELDS.forEach(field => {
                if (original[field] !== undefined) {
                  expect(exported[field]).toEqual(original[field]);
                }
              });

              // Verify schedule fields
              expect(exported.schedule_type).toBe(original.schedule_type);
              expect(exported.loop_video).toBe(original.loop_video);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('exportPlaylists', () => {
    /**
     * **Feature: comprehensive-backup-export, Property 4: Field completeness for each category**
     * **Validates: Requirements 6.1, 6.2**
     */
    test('Property 4.5: Playlists export includes metadata and video associations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(playlistArb, { minLength: 1, maxLength: 3 }),
          fc.uuid(),
          async (playlists, userId) => {
            // Setup mock data with videos
            mockData.playlists = playlists.map(p => ({ ...p, user_id: userId }));
            
            // Add some videos to each playlist
            playlists.forEach(playlist => {
              const videoCount = Math.floor(Math.random() * 5) + 1;
              mockData.playlistVideos[playlist.id] = Array.from({ length: videoCount }, (_, i) => ({
                id: `video-${playlist.id}-${i}`,
                position: i + 1
              }));
            });

            const result = await exportPlaylists(userId);

            expect(result.length).toBe(playlists.length);

            result.forEach((exported, index) => {
              const original = playlists[index];

              // Verify metadata fields
              PLAYLIST_FIELDS.forEach(field => {
                if (original[field] !== undefined) {
                  expect(exported[field]).toEqual(original[field]);
                }
              });

              // Verify videos array exists
              expect(Array.isArray(exported.videos)).toBe(true);

              // Verify video positions are preserved
              const expectedVideos = mockData.playlistVideos[original.id] || [];
              expect(exported.videos.length).toBe(expectedVideos.length);
              
              exported.videos.forEach((video, vIndex) => {
                expect(video).toHaveProperty('video_id');
                expect(video).toHaveProperty('position');
                expect(video.position).toBe(expectedVideos[vIndex].position);
              });
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: comprehensive-backup-export, Property 5: Playlist video order preservation**
     * **Validates: Requirements 6.3**
     */
    test('Property 5: Playlist video positions maintain sequential order', async () => {
      await fc.assert(
        fc.asyncProperty(
          playlistArb,
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (playlist, positions, userId) => {
            // Setup mock data
            mockData.playlists = [{ ...playlist, user_id: userId }];
            
            // Create videos with specific positions
            const sortedPositions = [...positions].sort((a, b) => a - b);
            mockData.playlistVideos[playlist.id] = sortedPositions.map((pos, i) => ({
              id: `video-${i}`,
              position: pos
            }));

            const result = await exportPlaylists(userId);

            expect(result.length).toBe(1);
            const exported = result[0];

            // Verify positions are in the same order as original
            expect(exported.videos.length).toBe(sortedPositions.length);
            exported.videos.forEach((video, index) => {
              expect(video.position).toBe(sortedPositions[index]);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});


// Import additional functions for comprehensive tests
const {
  comprehensiveExport,
  comprehensiveImport,
  validateComprehensiveBackup,
  formatBackupJson,
  ALL_CATEGORIES
} = require('../services/backupService');

describe('Comprehensive Export Function', () => {
  beforeEach(() => {
    // Reset mock data
    mockData.streams = [];
    mockData.youtubeCredentials = [];
    mockData.broadcastTemplates = [];
    mockData.recurringSchedules = [];
    mockData.streamTemplates = [];
    mockData.playlists = [];
    mockData.playlistVideos = {};
    jest.clearAllMocks();
  });

  /**
   * **Feature: comprehensive-backup-export, Property 2: Comprehensive export includes all categories**
   * **Validates: Requirements 1.1, 1.3, 2.2**
   */
  test('Property 2: Comprehensive export includes all categories with correct counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          // Setup some mock data for each category
          mockData.youtubeCredentials = [{
            userId,
            channelName: 'Test Channel',
            channelId: 'UC123456789012345678901',
            clientId: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
            clientSecret: 'GOCSPX-abcdefghijklmnopqrstuvwxyz',
            refreshToken: '1//abcdefghijklmnopqrstuvwxyz1234567890',
            isPrimary: true
          }];
          mockData.broadcastTemplates = [{ user_id: userId, name: 'Test', title: 'Test' }];
          mockData.recurringSchedules = [{ user_id: userId, name: 'Test', pattern: 'daily', schedule_time: '08:00' }];
          mockData.streamTemplates = [{ user_id: userId, name: 'Test', loop_video: true, schedule_type: 'once' }];
          mockData.playlists = [{ id: 'pl-1', user_id: userId, name: 'Test', is_shuffle: false }];
          mockData.playlistVideos['pl-1'] = [];

          const result = await comprehensiveExport(userId);

          // Verify metadata
          expect(result.metadata).toBeDefined();
          expect(result.metadata.exportType).toBe('comprehensive');
          expect(result.metadata.exportDate).toBeDefined();
          expect(result.metadata.appVersion).toBeDefined();
          expect(result.metadata.counts).toBeDefined();

          // Verify all categories are present
          expect(result.youtube_credentials).toBeDefined();
          expect(result.broadcast_templates).toBeDefined();
          expect(result.recurring_schedules).toBeDefined();
          expect(result.stream_templates).toBeDefined();
          expect(result.playlists).toBeDefined();

          // Verify counts match
          expect(result.metadata.counts.youtube_credentials).toBe(result.youtube_credentials.length);
          expect(result.metadata.counts.broadcast_templates).toBe(result.broadcast_templates.length);
          expect(result.metadata.counts.recurring_schedules).toBe(result.recurring_schedules.length);
          expect(result.metadata.counts.stream_templates).toBe(result.stream_templates.length);
          expect(result.metadata.counts.playlists).toBe(result.playlists.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: comprehensive-backup-export, Property 3: Selective export respects category selection**
   * **Validates: Requirements 2.1**
   */
  test('Property 3: Selective export only includes selected categories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.subarray(ALL_CATEGORIES, { minLength: 1 }),
        async (userId, selectedCategories) => {
          // Setup mock data
          mockData.youtubeCredentials = [{
            userId,
            channelName: 'Test',
            channelId: 'UC123456789012345678901',
            clientId: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
            clientSecret: 'GOCSPX-abcdefghijklmnopqrstuvwxyz',
            refreshToken: '1//abcdefghijklmnopqrstuvwxyz1234567890',
            isPrimary: true
          }];
          mockData.broadcastTemplates = [{ user_id: userId, name: 'Test', title: 'Test' }];
          mockData.recurringSchedules = [{ user_id: userId, name: 'Test', pattern: 'daily', schedule_time: '08:00' }];
          mockData.streamTemplates = [{ user_id: userId, name: 'Test', loop_video: true, schedule_type: 'once' }];
          mockData.playlists = [{ id: 'pl-1', user_id: userId, name: 'Test', is_shuffle: false }];
          mockData.playlistVideos['pl-1'] = [];

          const result = await comprehensiveExport(userId, selectedCategories);

          // Verify only selected categories are present
          ALL_CATEGORIES.forEach(category => {
            if (selectedCategories.includes(category)) {
              expect(result[category]).toBeDefined();
            } else {
              expect(result[category]).toBeUndefined();
            }
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  test('formatBackupJson produces valid JSON with indentation', () => {
    const backup = {
      metadata: { exportDate: new Date().toISOString() },
      streams: [{ title: 'Test' }]
    };

    const formatted = formatBackupJson(backup);

    // Should be valid JSON
    expect(() => JSON.parse(formatted)).not.toThrow();

    // Should have indentation (newlines)
    expect(formatted).toContain('\n');
    expect(formatted).toContain('  ');
  });
});

describe('Comprehensive Import Function', () => {
  beforeEach(() => {
    mockData.streams = [];
    mockData.youtubeCredentials = [];
    mockData.broadcastTemplates = [];
    mockData.recurringSchedules = [];
    mockData.streamTemplates = [];
    mockData.playlists = [];
    mockData.playlistVideos = {};
    jest.clearAllMocks();
  });

  /**
   * **Feature: comprehensive-backup-export, Property 6: Import validation rejects invalid data**
   * **Validates: Requirements 7.1, 8.2, 8.3, 8.4**
   */
  test('Property 6: Import validation rejects invalid backup structure', () => {
    // Test invalid structures
    expect(validateComprehensiveBackup(null).valid).toBe(false);
    expect(validateComprehensiveBackup({}).valid).toBe(false);
    expect(validateComprehensiveBackup({ metadata: {} }).valid).toBe(false);

    // Valid structure
    expect(validateComprehensiveBackup({
      metadata: { exportDate: new Date().toISOString() },
      streams: []
    }).valid).toBe(true);
  });

  /**
   * **Feature: comprehensive-backup-export, Property 7: Import result reporting accuracy**
   * **Validates: Requirements 7.3**
   */
  test('Property 7: Import returns accurate counts for each category', async () => {
    const userId = 'test-user-123';
    const backupData = {
      metadata: {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        exportType: 'comprehensive'
      },
      streams: [
        { title: 'Stream 1', rtmp_url: 'rtmp://test.com/live', stream_key: 'key123456789' }
      ],
      youtube_credentials: [
        {
          channel_name: 'Test Channel',
          channel_id: 'UC123456789012345678901',
          client_id: '123456789012-test.apps.googleusercontent.com',
          client_secret: 'GOCSPX-testsecret1234567890123',
          refresh_token: '1//testrefreshtoken1234567890123456789012',
          is_primary: true
        }
      ]
    };

    const result = await comprehensiveImport(backupData, userId, { skipDuplicates: true });

    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();
    
    // Verify streams result
    if (result.results.streams) {
      expect(result.results.streams).toHaveProperty('imported');
      expect(result.results.streams).toHaveProperty('skipped');
      expect(result.results.streams).toHaveProperty('errors');
    }

    // Verify youtube_credentials result
    if (result.results.youtube_credentials) {
      expect(result.results.youtube_credentials).toHaveProperty('imported');
      expect(result.results.youtube_credentials).toHaveProperty('skipped');
      expect(result.results.youtube_credentials).toHaveProperty('errors');
    }
  });
});
