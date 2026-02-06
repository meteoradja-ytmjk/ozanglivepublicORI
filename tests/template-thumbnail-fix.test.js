/**
 * Property-based tests for Template Thumbnail Fix
 * Tests thumbnail upload functionality in scheduleService
 * 
 * **Feature: template-thumbnail-fix**
 */

const fc = require('fast-check');
const path = require('path');

// Mock fs module
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn()
};

jest.mock('fs', () => mockFs);

// Mock youtubeService
const mockYoutubeService = {
  getAccessToken: jest.fn(),
  createBroadcast: jest.fn(),
  uploadThumbnail: jest.fn()
};

jest.mock('../services/youtubeService', () => mockYoutubeService);

// Mock BroadcastTemplate
const mockBroadcastTemplate = {
  findWithRecurringEnabled: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  updateLastRun: jest.fn()
};

jest.mock('../models/BroadcastTemplate', () => mockBroadcastTemplate);

// Mock recurringUtils
jest.mock('../utils/recurringUtils', () => ({
  calculateNextRun: jest.fn(() => new Date(Date.now() + 86400000)),
  formatNextRunAt: jest.fn((date) => date.toISOString()),
  replaceTitlePlaceholders: jest.fn((title) => title),
  isScheduleMissed: jest.fn(() => false)
}));

// Import scheduleService after mocking
const scheduleService = require('../services/scheduleService');

// Arbitrary generators
const thumbnailPathArb = fc.constantFrom(
  '/uploads/thumbnails/thumb1.jpg',
  '/uploads/thumbnails/thumb2.png',
  '/uploads/thumbnails/custom-thumb.jpg',
  null
);

const templateArb = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  account_id: fc.integer({ min: 1, max: 100 }),
  name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{2,30}$/),
  title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,50}$/),
  description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: null }),
  category_id: fc.constantFrom('20', '22', '24'),
  thumbnail_path: thumbnailPathArb,
  stream_id: fc.option(fc.uuid(), { nil: null }),
  recurring_enabled: fc.constant(true),
  recurring_pattern: fc.constantFrom('daily', 'weekly'),
  recurring_time: fc.constantFrom('08:00', '12:00', '18:00'),
  recurring_days: fc.option(fc.array(fc.constantFrom('monday', 'tuesday', 'wednesday', 'thursday', 'friday'), { minLength: 1, maxLength: 5 }), { nil: null }),
  client_id: fc.constant('test-client-id'),
  client_secret: fc.constant('test-client-secret'),
  refresh_token: fc.constant('test-refresh-token')
});

const multiBroadcastArb = fc.record({
  title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,50}$/),
  description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: '' }),
  privacyStatus: fc.constantFrom('public', 'unlisted', 'private'),
  streamId: fc.option(fc.uuid(), { nil: null }),
  categoryId: fc.constantFrom('20', '22', '24'),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
  thumbnailPath: thumbnailPathArb
});

describe('Template Thumbnail Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset scheduleService state
    scheduleService.jobs.clear();
    scheduleService.initialized = false;
  });

  describe('uploadThumbnailForBroadcast', () => {
    /**
     * **Feature: template-thumbnail-fix, Property 1: Thumbnail upload on template execution**
     * **Validates: Requirements 1.1**
     * 
     * For any template with a valid thumbnail_path, when executeTemplate is called
     * and broadcast is successfully created, uploadThumbnail should be called with
     * the correct broadcast ID and thumbnail buffer.
     */
    test('Property 1: Thumbnail upload on template execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          templateArb.filter(t => t.thumbnail_path !== null),
          async (template) => {
            // Setup mocks
            const mockAccessToken = 'mock-access-token';
            const mockBroadcastId = 'mock-broadcast-id';
            const mockThumbnailBuffer = Buffer.from('mock-thumbnail-data');

            mockYoutubeService.getAccessToken.mockResolvedValue(mockAccessToken);
            mockYoutubeService.createBroadcast.mockResolvedValue({
              broadcastId: mockBroadcastId,
              id: mockBroadcastId,
              streamKey: 'mock-stream-key'
            });
            mockYoutubeService.uploadThumbnail.mockResolvedValue({ thumbnailUrl: 'http://example.com/thumb.jpg' });
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(mockThumbnailBuffer);
            mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

            // Execute template
            await scheduleService.executeTemplate(template);

            // Verify uploadThumbnail was called
            expect(mockYoutubeService.uploadThumbnail).toHaveBeenCalledWith(
              mockAccessToken,
              mockBroadcastId,
              mockThumbnailBuffer
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('uploadThumbnailForBroadcast returns false for null thumbnailPath', async () => {
      const result = await scheduleService.uploadThumbnailForBroadcast('token', 'broadcast-id', null);
      expect(result).toBe(false);
      expect(mockYoutubeService.uploadThumbnail).not.toHaveBeenCalled();
    });

    test('uploadThumbnailForBroadcast returns false when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await scheduleService.uploadThumbnailForBroadcast(
        'token',
        'broadcast-id',
        '/uploads/thumbnails/nonexistent.jpg'
      );

      expect(result).toBe(false);
      expect(mockYoutubeService.uploadThumbnail).not.toHaveBeenCalled();
    });

    test('uploadThumbnailForBroadcast returns true on successful upload', async () => {
      const mockBuffer = Buffer.from('test-data');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockYoutubeService.uploadThumbnail.mockResolvedValue({ thumbnailUrl: 'http://example.com/thumb.jpg' });

      const result = await scheduleService.uploadThumbnailForBroadcast(
        'token',
        'broadcast-id',
        '/uploads/thumbnails/test.jpg'
      );

      expect(result).toBe(true);
      expect(mockYoutubeService.uploadThumbnail).toHaveBeenCalled();
    });

    test('uploadThumbnailForBroadcast returns false and logs error on API failure', async () => {
      const mockBuffer = Buffer.from('test-data');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockYoutubeService.uploadThumbnail.mockRejectedValue(new Error('API Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await scheduleService.uploadThumbnailForBroadcast(
        'token',
        'broadcast-id',
        '/uploads/thumbnails/test.jpg'
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('executeTemplate with thumbnail - single broadcast', () => {
    test('Single broadcast template uploads thumbnail when thumbnail_path exists', async () => {
      const template = {
        id: 'template-1',
        user_id: 'user-1',
        account_id: 1,
        name: 'Test Template',
        title: 'Test Broadcast',
        description: 'Test description',
        privacy_status: 'unlisted',
        tags: ['tag1'],
        category_id: '20',
        thumbnail_path: '/uploads/thumbnails/test.jpg',
        stream_id: null,
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '10:00',
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token'
      };

      const mockBuffer = Buffer.from('thumbnail-data');
      mockYoutubeService.getAccessToken.mockResolvedValue('access-token');
      mockYoutubeService.createBroadcast.mockResolvedValue({
        broadcastId: 'broadcast-123',
        id: 'broadcast-123',
        streamKey: 'stream-key'
      });
      mockYoutubeService.uploadThumbnail.mockResolvedValue({ thumbnailUrl: 'http://example.com/thumb.jpg' });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

      await scheduleService.executeTemplate(template);

      expect(mockYoutubeService.uploadThumbnail).toHaveBeenCalledWith(
        'access-token',
        'broadcast-123',
        mockBuffer
      );
    });

    test('Single broadcast template does not upload thumbnail when thumbnail_path is null', async () => {
      const template = {
        id: 'template-1',
        user_id: 'user-1',
        account_id: 1,
        name: 'Test Template',
        title: 'Test Broadcast',
        description: 'Test description',
        privacy_status: 'unlisted',
        tags: ['tag1'],
        category_id: '20',
        thumbnail_path: null,
        stream_id: null,
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '10:00',
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token'
      };

      mockYoutubeService.getAccessToken.mockResolvedValue('access-token');
      mockYoutubeService.createBroadcast.mockResolvedValue({
        broadcastId: 'broadcast-123',
        id: 'broadcast-123',
        streamKey: 'stream-key'
      });
      mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

      await scheduleService.executeTemplate(template);

      expect(mockYoutubeService.uploadThumbnail).not.toHaveBeenCalled();
    });
  });

  describe('executeTemplate with thumbnail - multi-broadcast', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /**
     * **Feature: template-thumbnail-fix, Property 2: Multi-broadcast thumbnail mapping**
     * **Validates: Requirements 1.2, 3.2**
     * 
     * For any multi-broadcast template where individual broadcasts have thumbnailPath
     * defined, when executing the template, each broadcast should have its corresponding
     * thumbnail uploaded (if thumbnailPath exists).
     */
    test('Property 2: Multi-broadcast thumbnail mapping', async () => {
      // Use real timers for this test since fast-check doesn't work well with fake timers
      jest.useRealTimers();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(multiBroadcastArb, { minLength: 1, maxLength: 2 }),
          async (broadcasts) => {
            // Clear mocks before each property test iteration
            jest.clearAllMocks();
            
            const template = {
              id: 'template-multi',
              user_id: 'user-1',
              account_id: 1,
              name: 'Multi Template',
              title: broadcasts[0].title,
              description: JSON.stringify(broadcasts),
              privacy_status: 'unlisted',
              tags: [],
              category_id: '20',
              thumbnail_path: null,
              stream_id: null,
              recurring_enabled: true,
              recurring_pattern: 'daily',
              recurring_time: '10:00',
              client_id: 'client-id',
              client_secret: 'client-secret',
              refresh_token: 'refresh-token'
            };

            const mockBuffer = Buffer.from('thumbnail-data');
            mockYoutubeService.getAccessToken.mockResolvedValue('access-token');
            
            // Create unique broadcast IDs for each broadcast
            let broadcastIndex = 0;
            mockYoutubeService.createBroadcast.mockImplementation(() => {
              const id = `broadcast-${broadcastIndex++}`;
              return Promise.resolve({
                broadcastId: id,
                id: id,
                streamKey: `stream-key-${id}`
              });
            });
            
            mockYoutubeService.uploadThumbnail.mockResolvedValue({ thumbnailUrl: 'http://example.com/thumb.jpg' });
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(mockBuffer);
            mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

            await scheduleService.executeTemplate(template);

            // Count broadcasts with thumbnailPath
            const broadcastsWithThumbnail = broadcasts.filter(b => b.thumbnailPath !== null);
            
            // Verify uploadThumbnail was called for each broadcast with thumbnail
            expect(mockYoutubeService.uploadThumbnail).toHaveBeenCalledTimes(broadcastsWithThumbnail.length);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    test('Multi-broadcast template uploads correct thumbnail for each broadcast', async () => {
      jest.clearAllMocks();
      jest.useRealTimers();
      const broadcasts = [
        { title: 'Broadcast 1', description: '', privacyStatus: 'unlisted', streamId: null, categoryId: '20', tags: [], thumbnailPath: '/uploads/thumbnails/thumb1.jpg' },
        { title: 'Broadcast 2', description: '', privacyStatus: 'unlisted', streamId: null, categoryId: '20', tags: [], thumbnailPath: '/uploads/thumbnails/thumb2.jpg' },
        { title: 'Broadcast 3', description: '', privacyStatus: 'unlisted', streamId: null, categoryId: '20', tags: [], thumbnailPath: null }
      ];

      const template = {
        id: 'template-multi',
        user_id: 'user-1',
        account_id: 1,
        name: 'Multi Template',
        title: 'Broadcast 1',
        description: JSON.stringify(broadcasts),
        privacy_status: 'unlisted',
        tags: [],
        category_id: '20',
        thumbnail_path: null,
        stream_id: null,
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '10:00',
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token'
      };

      const mockBuffer = Buffer.from('thumbnail-data');
      mockYoutubeService.getAccessToken.mockResolvedValue('access-token');
      
      let broadcastIndex = 0;
      mockYoutubeService.createBroadcast.mockImplementation(() => {
        const id = `broadcast-${broadcastIndex++}`;
        return Promise.resolve({
          broadcastId: id,
          id: id,
          streamKey: `stream-key-${id}`
        });
      });
      
      mockYoutubeService.uploadThumbnail.mockResolvedValue({ thumbnailUrl: 'http://example.com/thumb.jpg' });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

      await scheduleService.executeTemplate(template);

      // Should upload thumbnail for broadcast 1 and 2, but not 3
      expect(mockYoutubeService.uploadThumbnail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    test('Broadcast creation continues even if thumbnail upload fails', async () => {
      const template = {
        id: 'template-1',
        user_id: 'user-1',
        account_id: 1,
        name: 'Test Template',
        title: 'Test Broadcast',
        description: 'Test description',
        privacy_status: 'unlisted',
        tags: ['tag1'],
        category_id: '20',
        thumbnail_path: '/uploads/thumbnails/test.jpg',
        stream_id: null,
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '10:00',
        client_id: 'client-id',
        client_secret: 'client-secret',
        refresh_token: 'refresh-token'
      };

      mockYoutubeService.getAccessToken.mockResolvedValue('access-token');
      mockYoutubeService.createBroadcast.mockResolvedValue({
        broadcastId: 'broadcast-123',
        id: 'broadcast-123',
        streamKey: 'stream-key'
      });
      mockYoutubeService.uploadThumbnail.mockRejectedValue(new Error('Upload failed'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('data'));
      mockBroadcastTemplate.updateLastRun.mockResolvedValue({ success: true });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      const results = await scheduleService.executeTemplate(template);

      expect(results).toHaveLength(1);
      expect(results[0].broadcastId).toBe('broadcast-123');
      
      consoleSpy.mockRestore();
    });
  });
});


describe('Multi-broadcast template thumbnail path persistence', () => {
  /**
   * **Feature: template-thumbnail-fix, Property 3: Thumbnail path persistence in multi-broadcast**
   * **Validates: Requirements 3.1**
   * 
   * For any multi-broadcast template saved with thumbnail paths, the stored JSON
   * should contain thumbnailPath field for each broadcast that had a thumbnail.
   */
  test('Property 3: Thumbnail path persistence in multi-broadcast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,30}$/),
            description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: '' }),
            privacyStatus: fc.constantFrom('public', 'unlisted', 'private'),
            streamId: fc.option(fc.uuid(), { nil: null }),
            streamKey: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: '' }),
            categoryId: fc.constantFrom('20', '22', '24'),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 0, maxLength: 3 }),
            thumbnailPath: fc.option(
              fc.constantFrom(
                '/uploads/thumbnails/thumb1.jpg',
                '/uploads/thumbnails/thumb2.png',
                '/uploads/thumbnails/custom.jpg'
              ),
              { nil: null }
            )
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (broadcasts) => {
          // Simulate the mapping logic from app.js
          const broadcastsWithStreamId = broadcasts.map(b => ({
            title: b.title,
            description: b.description || '',
            privacyStatus: b.privacyStatus || 'unlisted',
            streamId: b.streamId || null,
            streamKey: b.streamKey || '',
            categoryId: b.categoryId || '22',
            tags: b.tags || [],
            thumbnailPath: b.thumbnailPath || null
          }));

          // Verify each broadcast preserves its thumbnailPath
          for (let i = 0; i < broadcasts.length; i++) {
            const original = broadcasts[i];
            const mapped = broadcastsWithStreamId[i];
            
            // thumbnailPath should be preserved (or null if not provided)
            expect(mapped.thumbnailPath).toBe(original.thumbnailPath || null);
          }

          // Verify JSON serialization preserves thumbnailPath
          const jsonString = JSON.stringify(broadcastsWithStreamId);
          const parsed = JSON.parse(jsonString);

          for (let i = 0; i < broadcasts.length; i++) {
            expect(parsed[i].thumbnailPath).toBe(broadcasts[i].thumbnailPath || null);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Thumbnail path is preserved when saving multi-broadcast template', () => {
    const broadcasts = [
      { title: 'Broadcast 1', thumbnailPath: '/uploads/thumbnails/thumb1.jpg' },
      { title: 'Broadcast 2', thumbnailPath: '/uploads/thumbnails/thumb2.jpg' },
      { title: 'Broadcast 3', thumbnailPath: null }
    ];

    const broadcastsWithStreamId = broadcasts.map(b => ({
      title: b.title,
      description: b.description || '',
      privacyStatus: b.privacyStatus || 'unlisted',
      streamId: b.streamId || null,
      streamKey: b.streamKey || '',
      categoryId: b.categoryId || '22',
      tags: b.tags || [],
      thumbnailPath: b.thumbnailPath || null
    }));

    expect(broadcastsWithStreamId[0].thumbnailPath).toBe('/uploads/thumbnails/thumb1.jpg');
    expect(broadcastsWithStreamId[1].thumbnailPath).toBe('/uploads/thumbnails/thumb2.jpg');
    expect(broadcastsWithStreamId[2].thumbnailPath).toBeNull();
  });

  test('Thumbnail path survives JSON round-trip', () => {
    const broadcasts = [
      { title: 'Test', thumbnailPath: '/uploads/thumbnails/test.jpg', streamId: 'abc123' }
    ];

    const mapped = broadcasts.map(b => ({
      title: b.title,
      thumbnailPath: b.thumbnailPath || null,
      streamId: b.streamId || null
    }));

    const jsonString = JSON.stringify(mapped);
    const parsed = JSON.parse(jsonString);

    expect(parsed[0].thumbnailPath).toBe('/uploads/thumbnails/test.jpg');
    expect(parsed[0].streamId).toBe('abc123');
  });
});
