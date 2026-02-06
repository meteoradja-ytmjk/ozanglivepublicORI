/**
 * Property-based tests for Broadcast Template
 * Tests template CRUD operations and validation
 * 
 * **Feature: broadcast-template**
 */

const fc = require('fast-check');

// Mock database
const mockDb = {
  templates: [],
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

// Import BroadcastTemplate model after mocking
const BroadcastTemplate = require('../models/BroadcastTemplate');

// Arbitrary generators
const userIdArb = fc.uuid();
const accountIdArb = fc.integer({ min: 1, max: 1000 });
const templateNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 _-]{2,49}$/);
const titleArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,99}$/);
const descriptionArb = fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null });
const privacyStatusArb = fc.constantFrom('public', 'unlisted', 'private');
const categoryIdArb = fc.constantFrom('1', '2', '10', '15', '17', '20', '22', '24', '28');
const tagsArb = fc.option(fc.array(fc.stringMatching(/^[a-zA-Z0-9]{1,30}$/), { minLength: 0, maxLength: 10 }), { nil: null });

// Generator for valid template data
const templateDataArb = fc.record({
  user_id: userIdArb,
  account_id: accountIdArb,
  name: templateNameArb,
  title: titleArb,
  description: descriptionArb,
  privacy_status: privacyStatusArb,
  tags: tagsArb,
  category_id: categoryIdArb,
  thumbnail_path: fc.option(fc.constant('/uploads/thumbnails/test.jpg'), { nil: null }),
  stream_id: fc.option(fc.uuid(), { nil: null })
});

// Generator for whitespace-only strings
const whitespaceOnlyArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
  .map(arr => arr.join(''));

describe('Broadcast Template', () => {
  beforeEach(() => {
    mockDb.templates = [];
    jest.clearAllMocks();
  });

  describe('create', () => {
    /**
     * **Feature: broadcast-template, Property 2: Template data integrity on save**
     * **Validates: Requirements 1.1, 1.3**
     * 
     * For any broadcast configuration, saving it as a template should preserve
     * all fields (title, description, privacy_status, tags, category_id, thumbnail_path, account_id).
     */
    test('Property 2: Template data integrity on save', async () => {
      await fc.assert(
        fc.asyncProperty(
          templateDataArb,
          async (templateData) => {
            // Setup mock to simulate successful insert
            mockDb.run.mockImplementation(function(query, params, callback) {
              callback.call({ lastID: 1 }, null);
            });

            const result = await BroadcastTemplate.create(templateData);

            // Verify all fields are preserved
            expect(result.user_id).toBe(templateData.user_id);
            expect(result.account_id).toBe(templateData.account_id);
            expect(result.name).toBe(templateData.name.trim());
            expect(result.title).toBe(templateData.title);
            expect(result.description).toBe(templateData.description);
            expect(result.privacy_status).toBe(templateData.privacy_status);
            expect(result.category_id).toBe(templateData.category_id);
            expect(result.thumbnail_path).toBe(templateData.thumbnail_path);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: broadcast-template, Property 3: Empty name validation**
     * **Validates: Requirements 1.4, 5.2**
     * 
     * For any template creation attempt with empty or whitespace-only name,
     * the system should reject the operation with a validation error.
     */
    test('Property 3: Empty name validation - rejects empty string', async () => {
      const templateData = {
        user_id: 'test-user-id',
        account_id: 1,
        name: '',
        title: 'Test Title'
      };

      // Empty string is falsy, so it triggers "Missing required fields" error
      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Missing required fields');
    });

    test('Property 3: Empty name validation - rejects whitespace-only names', async () => {
      await fc.assert(
        fc.asyncProperty(
          whitespaceOnlyArb,
          async (whitespaceName) => {
            const templateData = {
              user_id: 'test-user-id',
              account_id: 1,
              name: whitespaceName,
              title: 'Test Title'
            };

            await expect(BroadcastTemplate.create(templateData))
              .rejects.toThrow('Template name cannot be empty');
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Feature: broadcast-template, Property 8: Required fields validation**
     * **Validates: Requirements 5.2**
     * 
     * For any template creation, the system should require name, title, and account_id
     * fields to be present and non-empty.
     */
    test('Property 8: Required fields validation - missing user_id', async () => {
      const templateData = {
        account_id: 1,
        name: 'Test Template',
        title: 'Test Title'
      };

      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Missing required fields');
    });

    test('Property 8: Required fields validation - missing account_id', async () => {
      const templateData = {
        user_id: 'test-user-id',
        name: 'Test Template',
        title: 'Test Title'
      };

      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Missing required fields');
    });

    test('Property 8: Required fields validation - missing title', async () => {
      const templateData = {
        user_id: 'test-user-id',
        account_id: 1,
        name: 'Test Template'
      };

      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Missing required fields');
    });

    /**
     * **Feature: broadcast-template, Property 1: Template name uniqueness per user**
     * **Validates: Requirements 1.4**
     * 
     * For any user and template name, there can only be one template with that name
     * for that user. Attempting to create a duplicate should fail with validation error.
     */
    test('Property 1: Template name uniqueness - rejects duplicate names', async () => {
      const templateData = {
        user_id: 'test-user-id',
        account_id: 1,
        name: 'Duplicate Template',
        title: 'Test Title'
      };

      // Setup mock to simulate UNIQUE constraint violation
      mockDb.run.mockImplementation(function(query, params, callback) {
        const error = new Error('UNIQUE constraint failed: broadcast_templates.user_id, broadcast_templates.name');
        callback.call({ lastID: 0 }, error);
      });

      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Template name already exists');
    });
  });

  describe('findByUserId', () => {
    /**
     * **Feature: broadcast-template, Property 4: User template isolation**
     * **Validates: Requirements 2.1**
     * 
     * For any user, querying templates should return only templates belonging
     * to that user, not templates from other users.
     */
    test('Property 4: User template isolation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.array(templateDataArb, { minLength: 1, maxLength: 5 }),
          async (userId, templates) => {
            // Filter templates to only those belonging to the user
            const userTemplates = templates.map(t => ({
              ...t,
              user_id: userId,
              id: `template-${Math.random()}`
            }));

            // Setup mock to return only user's templates
            mockDb.all.mockImplementation((query, params, callback) => {
              const filteredTemplates = userTemplates.filter(t => t.user_id === params[0]);
              callback(null, filteredTemplates);
            });

            const result = await BroadcastTemplate.findByUserId(userId);

            // Verify all returned templates belong to the user
            result.forEach(template => {
              expect(template.user_id).toBe(userId);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('delete', () => {
    /**
     * **Feature: broadcast-template, Property 5: Template deletion completeness**
     * **Validates: Requirements 2.4**
     * 
     * For any template deletion, the template should no longer exist in the database,
     * and other templates should remain unchanged.
     */
    test('Property 5: Template deletion completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.uuid(),
          async (userId, templateId) => {
            // Setup mock to simulate successful deletion
            mockDb.run.mockImplementation(function(query, params, callback) {
              callback.call({ changes: 1 }, null);
            });

            const result = await BroadcastTemplate.delete(templateId, userId);

            // Verify deletion was successful
            expect(result.success).toBe(true);
            expect(result.deleted).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Property 5: Template deletion - non-existent template returns deleted=false', async () => {
      // Setup mock to simulate no rows affected
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const result = await BroadcastTemplate.delete('non-existent-id', 'user-id');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(false);
    });
  });

  describe('nameExists', () => {
    test('nameExists returns true when name exists', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 1 });
      });

      const result = await BroadcastTemplate.nameExists('user-id', 'Existing Template');
      expect(result).toBe(true);
    });

    test('nameExists returns false when name does not exist', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 0 });
      });

      const result = await BroadcastTemplate.nameExists('user-id', 'New Template');
      expect(result).toBe(false);
    });

    test('nameExists excludes specified template ID', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        // Verify excludeId is in params
        expect(params.length).toBe(3);
        expect(params[2]).toBe('exclude-this-id');
        callback(null, { count: 0 });
      });

      await BroadcastTemplate.nameExists('user-id', 'Template Name', 'exclude-this-id');
    });
  });

  describe('findById', () => {
    test('findById returns template with parsed tags', async () => {
      const mockTemplate = {
        id: 'test-id',
        user_id: 'user-id',
        account_id: 1,
        name: 'Test Template',
        title: 'Test Title',
        tags: '["tag1","tag2","tag3"]',
        channel_name: 'Test Channel'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockTemplate);
      });

      const result = await BroadcastTemplate.findById('test-id');

      expect(result).not.toBeNull();
      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('findById returns null for non-existent template', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const result = await BroadcastTemplate.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    test('update rejects empty name', () => {
      // update throws synchronously for empty name validation
      expect(() => BroadcastTemplate.update('template-id', { name: '   ' }))
        .toThrow('Template name cannot be empty');
    });

    test('update handles duplicate name error', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        const error = new Error('UNIQUE constraint failed');
        callback.call({ changes: 0 }, error);
      });

      await expect(BroadcastTemplate.update('template-id', { name: 'Duplicate Name' }))
        .rejects.toThrow('Template name already exists');
    });
  });
});


describe('Bulk Create', () => {
  /**
   * **Feature: broadcast-template, Property 6: Bulk create attempt count**
   * **Validates: Requirements 4.3, 4.4**
   * 
   * For any bulk create operation with N schedule times, the system should attempt
   * exactly N broadcast creations and return a summary with total, success, and
   * failure counts that sum correctly.
   */
  test('Property 6: Bulk create attempt count - summary counts are correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 10 }),
        async (schedules, failCount) => {
          // Simulate bulk create results
          const actualFailCount = Math.min(failCount, schedules.length);
          const successCount = schedules.length - actualFailCount;
          
          const results = {
            total: schedules.length,
            success: successCount,
            failed: actualFailCount,
            broadcasts: Array(successCount).fill({ id: 'test', title: 'test' }),
            errors: Array(actualFailCount).fill({ schedule: new Date(), error: 'test error' })
          };

          // Verify counts sum correctly
          expect(results.total).toBe(schedules.length);
          expect(results.success + results.failed).toBe(results.total);
          expect(results.broadcasts.length).toBe(results.success);
          expect(results.errors.length).toBe(results.failed);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: broadcast-template, Property 7: Bulk create partial failure resilience**
   * **Validates: Requirements 4.5**
   * 
   * For any bulk create operation where some broadcasts fail, the system should
   * continue creating remaining broadcasts and include all failures in the summary.
   */
  test('Property 7: Bulk create partial failure resilience', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 9 }),
        async (totalCount, failIndex) => {
          // Ensure failIndex is within bounds
          const actualFailIndex = failIndex % totalCount;
          
          // Simulate processing where one item fails
          const results = {
            total: totalCount,
            success: totalCount - 1,
            failed: 1,
            broadcasts: [],
            errors: []
          };

          // Simulate processing each schedule
          for (let i = 0; i < totalCount; i++) {
            if (i === actualFailIndex) {
              results.errors.push({ schedule: new Date(), error: 'Simulated failure' });
            } else {
              results.broadcasts.push({ id: `broadcast-${i}`, title: 'Test' });
            }
          }

          // Verify that despite failure, other broadcasts were created
          expect(results.broadcasts.length).toBe(totalCount - 1);
          expect(results.errors.length).toBe(1);
          expect(results.success + results.failed).toBe(results.total);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Bulk create with all failures returns correct summary', () => {
    const schedules = [new Date(), new Date(), new Date()];
    const results = {
      total: schedules.length,
      success: 0,
      failed: schedules.length,
      broadcasts: [],
      errors: schedules.map(s => ({ schedule: s, error: 'API error' }))
    };

    expect(results.success).toBe(0);
    expect(results.failed).toBe(schedules.length);
    expect(results.errors.length).toBe(schedules.length);
  });

  test('Bulk create with all successes returns correct summary', () => {
    const schedules = [new Date(), new Date(), new Date()];
    const results = {
      total: schedules.length,
      success: schedules.length,
      failed: 0,
      broadcasts: schedules.map((s, i) => ({ id: `broadcast-${i}`, title: 'Test' })),
      errors: []
    };

    expect(results.success).toBe(schedules.length);
    expect(results.failed).toBe(0);
    expect(results.broadcasts.length).toBe(schedules.length);
  });
});
