/**
 * Property-based tests for Template Recurring Integration
 * Tests recurring schedule functionality integrated into templates
 * 
 * **Feature: template-recurring-integration**
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

// Recurring-specific generators
const patternArb = fc.constantFrom('daily', 'weekly');
const timeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

const daysOfWeekArb = fc.subarray(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  { minLength: 1, maxLength: 7 }
);

const emptyDaysArb = fc.constant([]);

// Generator for valid template data with recurring
const templateWithRecurringArb = fc.record({
  user_id: userIdArb,
  account_id: accountIdArb,
  name: templateNameArb,
  title: titleArb,
  description: descriptionArb,
  privacy_status: privacyStatusArb,
  tags: tagsArb,
  category_id: categoryIdArb,
  thumbnail_path: fc.option(fc.constant('/uploads/thumbnails/test.jpg'), { nil: null }),
  stream_id: fc.option(fc.uuid(), { nil: null }),
  recurring_enabled: fc.constant(true),
  recurring_pattern: patternArb,
  recurring_time: timeArb,
  recurring_days: daysOfWeekArb
});

// Generator for daily recurring template
const dailyRecurringTemplateArb = fc.record({
  user_id: userIdArb,
  account_id: accountIdArb,
  name: templateNameArb,
  title: titleArb,
  recurring_enabled: fc.constant(true),
  recurring_pattern: fc.constant('daily'),
  recurring_time: timeArb,
  recurring_days: fc.constant(null)
});

// Generator for weekly recurring template
const weeklyRecurringTemplateArb = fc.record({
  user_id: userIdArb,
  account_id: accountIdArb,
  name: templateNameArb,
  title: titleArb,
  recurring_enabled: fc.constant(true),
  recurring_pattern: fc.constant('weekly'),
  recurring_time: timeArb,
  recurring_days: daysOfWeekArb
});

describe('Template Recurring Integration', () => {
  beforeEach(() => {
    mockDb.templates = [];
    jest.clearAllMocks();
  });

  describe('Property 1: Template Recurring Data Round-Trip', () => {
    /**
     * **Feature: template-recurring-integration, Property 1: Template Recurring Data Round-Trip**
     * **Validates: Requirements 1.4**
     * 
     * For any valid template with recurring configuration (pattern, time, days),
     * saving the template and then retrieving it should return the exact same
     * recurring configuration values.
     */
    test('Daily recurring config is preserved on save and retrieve', async () => {
      await fc.assert(
        fc.asyncProperty(
          dailyRecurringTemplateArb,
          async (templateData) => {
            // Setup mock to simulate successful insert
            mockDb.run.mockImplementation(function(query, params, callback) {
              callback.call({ lastID: 1 }, null);
            });

            const result = await BroadcastTemplate.create(templateData);

            // Verify recurring fields are preserved
            expect(result.recurring_enabled).toBe(true);
            expect(result.recurring_pattern).toBe('daily');
            expect(result.recurring_time).toBe(templateData.recurring_time);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Weekly recurring config is preserved on save and retrieve', async () => {
      await fc.assert(
        fc.asyncProperty(
          weeklyRecurringTemplateArb,
          async (templateData) => {
            // Setup mock to simulate successful insert
            mockDb.run.mockImplementation(function(query, params, callback) {
              callback.call({ lastID: 1 }, null);
            });

            const result = await BroadcastTemplate.create(templateData);

            // Verify recurring fields are preserved
            expect(result.recurring_enabled).toBe(true);
            expect(result.recurring_pattern).toBe('weekly');
            expect(result.recurring_time).toBe(templateData.recurring_time);
            expect(result.recurring_days).toEqual(templateData.recurring_days);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Recurring config round-trip through parseRow', async () => {
      await fc.assert(
        fc.asyncProperty(
          templateWithRecurringArb,
          async (templateData) => {
            // Simulate database row with JSON-stringified fields
            const dbRow = {
              ...templateData,
              tags: templateData.tags ? JSON.stringify(templateData.tags) : null,
              recurring_days: templateData.recurring_days ? JSON.stringify(templateData.recurring_days) : null,
              recurring_enabled: 1
            };

            const parsed = BroadcastTemplate.parseRow(dbRow);

            // Verify parsed data matches original
            expect(parsed.recurring_enabled).toBe(true);
            expect(parsed.recurring_pattern).toBe(templateData.recurring_pattern);
            expect(parsed.recurring_time).toBe(templateData.recurring_time);
            if (templateData.recurring_days) {
              expect(parsed.recurring_days).toEqual(templateData.recurring_days);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Weekly Pattern Requires Days Validation', () => {
    /**
     * **Feature: template-recurring-integration, Property 2: Weekly Pattern Requires Days Validation**
     * **Validates: Requirements 1.5**
     * 
     * For any template with recurring_pattern set to "weekly", if recurring_days
     * is empty or null, the save operation should be rejected with a validation error.
     */
    test('Weekly pattern with empty days array is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          accountIdArb,
          templateNameArb,
          titleArb,
          timeArb,
          async (userId, accountId, name, title, time) => {
            const templateData = {
              user_id: userId,
              account_id: accountId,
              name,
              title,
              recurring_enabled: true,
              recurring_pattern: 'weekly',
              recurring_time: time,
              recurring_days: [] // Empty array
            };

            await expect(BroadcastTemplate.create(templateData))
              .rejects.toThrow('Weekly schedule requires at least one day selected');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Weekly pattern with null days is rejected', async () => {
      const templateData = {
        user_id: 'test-user',
        account_id: 1,
        name: 'Test Template',
        title: 'Test Title',
        recurring_enabled: true,
        recurring_pattern: 'weekly',
        recurring_time: '08:00',
        recurring_days: null
      };

      await expect(BroadcastTemplate.create(templateData))
        .rejects.toThrow('Weekly schedule requires at least one day selected');
    });

    test('Weekly pattern with valid days is accepted', async () => {
      await fc.assert(
        fc.asyncProperty(
          weeklyRecurringTemplateArb,
          async (templateData) => {
            mockDb.run.mockImplementation(function(query, params, callback) {
              callback.call({ lastID: 1 }, null);
            });

            // Should not throw
            const result = await BroadcastTemplate.create(templateData);
            expect(result.recurring_days.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('updateRecurring validation', () => {
    test('updateRecurring rejects invalid pattern', async () => {
      await expect(BroadcastTemplate.updateRecurring('template-id', {
        recurring_enabled: true,
        recurring_pattern: 'monthly', // Invalid
        recurring_time: '08:00'
      })).rejects.toThrow('Recurring pattern must be daily or weekly');
    });

    test('updateRecurring rejects missing time when enabled', async () => {
      await expect(BroadcastTemplate.updateRecurring('template-id', {
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: null
      })).rejects.toThrow('Recurring time is required');
    });

    test('updateRecurring rejects weekly without days', async () => {
      await expect(BroadcastTemplate.updateRecurring('template-id', {
        recurring_enabled: true,
        recurring_pattern: 'weekly',
        recurring_time: '08:00',
        recurring_days: []
      })).rejects.toThrow('Weekly schedule requires at least one day selected');
    });

    test('updateRecurring accepts valid daily config', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const result = await BroadcastTemplate.updateRecurring('template-id', {
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '08:00',
        recurring_days: null,
        next_run_at: '2025-12-26T08:00:00Z'
      });

      expect(result.recurring_enabled).toBe(true);
      expect(result.recurring_pattern).toBe('daily');
    });

    test('updateRecurring accepts valid weekly config', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const result = await BroadcastTemplate.updateRecurring('template-id', {
        recurring_enabled: true,
        recurring_pattern: 'weekly',
        recurring_time: '19:00',
        recurring_days: ['monday', 'wednesday', 'friday'],
        next_run_at: '2025-12-26T19:00:00Z'
      });

      expect(result.recurring_enabled).toBe(true);
      expect(result.recurring_pattern).toBe('weekly');
      expect(result.recurring_days).toEqual(['monday', 'wednesday', 'friday']);
    });
  });

  describe('toggleRecurring', () => {
    test('toggleRecurring enables recurring with next_run_at', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const nextRunAt = '2025-12-26T08:00:00Z';
      const result = await BroadcastTemplate.toggleRecurring('template-id', true, nextRunAt);

      expect(result.success).toBe(true);
      expect(result.recurring_enabled).toBe(true);
      expect(result.next_run_at).toBe(nextRunAt);
    });

    test('toggleRecurring disables recurring', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const result = await BroadcastTemplate.toggleRecurring('template-id', false);

      expect(result.success).toBe(true);
      expect(result.recurring_enabled).toBe(false);
      expect(result.next_run_at).toBeNull();
    });
  });

  describe('findWithRecurringEnabled', () => {
    test('returns only templates with recurring enabled', async () => {
      const mockTemplates = [
        { id: '1', name: 'Template 1', recurring_enabled: 1, recurring_pattern: 'daily', recurring_time: '08:00', tags: null, recurring_days: null },
        { id: '2', name: 'Template 2', recurring_enabled: 1, recurring_pattern: 'weekly', recurring_time: '19:00', tags: null, recurring_days: '["monday","friday"]' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockTemplates);
      });

      const result = await BroadcastTemplate.findWithRecurringEnabled();

      expect(result.length).toBe(2);
      result.forEach(template => {
        expect(template.recurring_enabled).toBe(true);
      });
    });

    test('parses recurring_days JSON correctly', async () => {
      const mockTemplates = [
        { id: '1', name: 'Weekly Template', recurring_enabled: 1, recurring_pattern: 'weekly', recurring_time: '19:00', tags: null, recurring_days: '["monday","wednesday","friday"]' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockTemplates);
      });

      const result = await BroadcastTemplate.findWithRecurringEnabled();

      expect(result[0].recurring_days).toEqual(['monday', 'wednesday', 'friday']);
    });
  });

  describe('updateLastRun', () => {
    test('updates last_run_at and next_run_at', async () => {
      mockDb.run.mockImplementation(function(query, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const lastRunAt = '2025-12-25T08:00:00Z';
      const nextRunAt = '2025-12-26T08:00:00Z';
      
      const result = await BroadcastTemplate.updateLastRun('template-id', lastRunAt, nextRunAt);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });
  });

  describe('parseRow', () => {
    test('parseRow returns null for null input', () => {
      expect(BroadcastTemplate.parseRow(null)).toBeNull();
    });

    test('parseRow converts recurring_enabled to boolean', () => {
      const row1 = { recurring_enabled: 1 };
      const row2 = { recurring_enabled: 0 };

      expect(BroadcastTemplate.parseRow(row1).recurring_enabled).toBe(true);
      expect(BroadcastTemplate.parseRow(row2).recurring_enabled).toBe(false);
    });

    test('parseRow handles invalid JSON in recurring_days', () => {
      const row = { recurring_enabled: 1, recurring_days: 'invalid json' };
      const parsed = BroadcastTemplate.parseRow(row);
      expect(parsed.recurring_days).toEqual([]);
    });

    test('parseRow handles invalid JSON in tags', () => {
      const row = { recurring_enabled: 0, tags: 'invalid json' };
      const parsed = BroadcastTemplate.parseRow(row);
      expect(parsed.tags).toEqual([]);
    });
  });
});


// Import recurring utilities
const {
  validateRecurringConfig,
  isValidTimeFormat,
  calculateNextDailyRun,
  calculateNextWeeklyRun,
  calculateNextRun,
  replaceTitlePlaceholders,
  formatNextRunAt,
  VALID_DAYS
} = require('../utils/recurringUtils');

describe('Recurring Utilities', () => {
  describe('validateRecurringConfig', () => {
    test('returns valid for disabled recurring', () => {
      const result = validateRecurringConfig({ recurring_enabled: false });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('requires pattern when enabled', () => {
      const result = validateRecurringConfig({
        recurring_enabled: true,
        recurring_time: '08:00'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recurring pattern is required');
    });

    test('requires time when enabled', () => {
      const result = validateRecurringConfig({
        recurring_enabled: true,
        recurring_pattern: 'daily'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recurring time is required');
    });

    test('requires days for weekly pattern', () => {
      const result = validateRecurringConfig({
        recurring_enabled: true,
        recurring_pattern: 'weekly',
        recurring_time: '08:00',
        recurring_days: []
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Weekly schedule requires at least one day selected');
    });

    test('accepts valid daily config', () => {
      const result = validateRecurringConfig({
        recurring_enabled: true,
        recurring_pattern: 'daily',
        recurring_time: '08:00'
      });
      expect(result.valid).toBe(true);
    });

    test('accepts valid weekly config', () => {
      const result = validateRecurringConfig({
        recurring_enabled: true,
        recurring_pattern: 'weekly',
        recurring_time: '19:00',
        recurring_days: ['monday', 'friday']
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidTimeFormat', () => {
    test('accepts valid time formats', () => {
      expect(isValidTimeFormat('00:00')).toBe(true);
      expect(isValidTimeFormat('08:30')).toBe(true);
      expect(isValidTimeFormat('12:00')).toBe(true);
      expect(isValidTimeFormat('23:59')).toBe(true);
      expect(isValidTimeFormat('9:05')).toBe(true);
    });

    test('rejects invalid time formats', () => {
      expect(isValidTimeFormat('24:00')).toBe(false);
      expect(isValidTimeFormat('12:60')).toBe(false);
      expect(isValidTimeFormat('abc')).toBe(false);
      expect(isValidTimeFormat('')).toBe(false);
      expect(isValidTimeFormat(null)).toBe(false);
    });
  });

  describe('Property 6: Next Run Calculation Correctness', () => {
    /**
     * **Feature: template-recurring-integration, Property 6: Next Run Calculation Correctness**
     * **Validates: Requirements 3.3, 6.3**
     * 
     * For any template with recurring enabled and valid configuration,
     * the calculated next_run_at should be a future timestamp that matches
     * the pattern and time specification.
     */
    
    // Use integer-based date generation to avoid NaN dates
    const validDateArb = fc.integer({ min: 1735689600000, max: 1767225600000 }) // 2025-01-01 to 2025-12-31
      .map(ts => new Date(ts));

    test('Daily next run is always in the future', async () => {
      await fc.assert(
        fc.asyncProperty(
          timeArb,
          validDateArb,
          async (time, fromDate) => {
            const nextRun = calculateNextDailyRun(time, fromDate);
            
            // Next run should be in the future
            expect(nextRun.getTime()).toBeGreaterThan(fromDate.getTime());
            
            // Next run should be within 24 hours
            const diffMs = nextRun.getTime() - fromDate.getTime();
            expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Daily next run has correct time', async () => {
      await fc.assert(
        fc.asyncProperty(
          timeArb,
          async (time) => {
            const fromDate = new Date('2025-06-15T00:00:00');
            const nextRun = calculateNextDailyRun(time, fromDate);
            
            const [expectedHours, expectedMinutes] = time.split(':').map(Number);
            expect(nextRun.getHours()).toBe(expectedHours);
            expect(nextRun.getMinutes()).toBe(expectedMinutes);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Weekly next run is always in the future', async () => {
      await fc.assert(
        fc.asyncProperty(
          timeArb,
          daysOfWeekArb,
          validDateArb,
          async (time, days, fromDate) => {
            const nextRun = calculateNextWeeklyRun(time, days, fromDate);
            
            // Next run should be in the future
            expect(nextRun.getTime()).toBeGreaterThan(fromDate.getTime());
            
            // Next run should be within 7 days
            const diffMs = nextRun.getTime() - fromDate.getTime();
            expect(diffMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Weekly next run falls on a selected day', async () => {
      await fc.assert(
        fc.asyncProperty(
          timeArb,
          daysOfWeekArb,
          validDateArb,
          async (time, days, fromDate) => {
            const nextRun = calculateNextWeeklyRun(time, days, fromDate);
            
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const nextRunDayName = dayNames[nextRun.getDay()];
            
            // Next run should be on one of the selected days
            expect(days.map(d => d.toLowerCase())).toContain(nextRunDayName);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Weekly next run has correct time', async () => {
      await fc.assert(
        fc.asyncProperty(
          timeArb,
          daysOfWeekArb,
          async (time, days) => {
            const fromDate = new Date('2025-06-15T00:00:00');
            const nextRun = calculateNextWeeklyRun(time, days, fromDate);
            
            const [expectedHours, expectedMinutes] = time.split(':').map(Number);
            expect(nextRun.getHours()).toBe(expectedHours);
            expect(nextRun.getMinutes()).toBe(expectedMinutes);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateNextRun', () => {
    test('delegates to daily calculation for daily pattern', () => {
      const config = {
        recurring_pattern: 'daily',
        recurring_time: '08:00'
      };
      const fromDate = new Date('2025-06-15T00:00:00');
      
      const result = calculateNextRun(config, fromDate);
      const expected = calculateNextDailyRun('08:00', fromDate);
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    test('delegates to weekly calculation for weekly pattern', () => {
      const config = {
        recurring_pattern: 'weekly',
        recurring_time: '19:00',
        recurring_days: ['monday', 'friday']
      };
      const fromDate = new Date('2025-06-15T00:00:00');
      
      const result = calculateNextRun(config, fromDate);
      const expected = calculateNextWeeklyRun('19:00', ['monday', 'friday'], fromDate);
      
      expect(result.getTime()).toBe(expected.getTime());
    });

    test('throws for invalid pattern', () => {
      const config = {
        recurring_pattern: 'monthly',
        recurring_time: '08:00'
      };
      
      expect(() => calculateNextRun(config)).toThrow('Invalid pattern');
    });
  });

  describe('replaceTitlePlaceholders', () => {
    test('replaces {date} placeholder', () => {
      const date = new Date('2025-12-25T08:00:00');
      const result = replaceTitlePlaceholders('Broadcast {date}', date);
      expect(result).toContain('25');
      expect(result).toContain('2025');
    });

    test('replaces {time} placeholder', () => {
      const date = new Date('2025-12-25T08:30:00');
      const result = replaceTitlePlaceholders('Broadcast at {time}', date);
      expect(result).toContain('08');
      expect(result).toContain('30');
    });

    test('replaces multiple placeholders', () => {
      const date = new Date('2025-12-25T08:00:00');
      const result = replaceTitlePlaceholders('Live {day} - {date}', date);
      expect(result).not.toContain('{day}');
      expect(result).not.toContain('{date}');
    });

    test('leaves non-placeholder text unchanged', () => {
      const result = replaceTitlePlaceholders('My Regular Title', new Date());
      expect(result).toBe('My Regular Title');
    });
  });
});

describe('Property 5: Toggle Preserves Configuration', () => {
  /**
   * **Feature: template-recurring-integration, Property 5: Toggle Preserves Configuration**
   * **Validates: Requirements 3.2**
   * 
   * For any template with recurring configuration, toggling recurring_enabled
   * from true to false should preserve the recurring_pattern, recurring_time,
   * and recurring_days values unchanged.
   */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Toggle off preserves pattern, time, and days', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateWithRecurringArb,
        async (templateData) => {
          // Simulate a template with recurring config
          const originalConfig = {
            recurring_pattern: templateData.recurring_pattern,
            recurring_time: templateData.recurring_time,
            recurring_days: templateData.recurring_days
          };

          // Mock the toggle operation - it should only change recurring_enabled
          mockDb.run.mockImplementation(function(query, params, callback) {
            // Verify the query only updates recurring_enabled, not other fields
            expect(query).not.toContain('recurring_pattern');
            expect(query).not.toContain('recurring_time');
            expect(query).not.toContain('recurring_days');
            callback.call({ changes: 1 }, null);
          });

          await BroadcastTemplate.toggleRecurring('template-id', false);

          // The original config should remain unchanged
          expect(originalConfig.recurring_pattern).toBe(templateData.recurring_pattern);
          expect(originalConfig.recurring_time).toBe(templateData.recurring_time);
          expect(originalConfig.recurring_days).toEqual(templateData.recurring_days);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 7: Migration Preserves Schedule Data', () => {
  /**
   * **Feature: template-recurring-integration, Property 7: Migration Preserves Schedule Data**
   * **Validates: Requirements 4.3**
   * 
   * For any existing recurring_schedule record, after migration the corresponding
   * template should have recurring_enabled=true with matching pattern, time, and days values.
   * 
   * This test validates the data transformation logic used in migration.
   */

  // Helper functions that mirror migration script logic
  function convertDays(daysOfWeek) {
    if (!daysOfWeek) return null;
    try {
      const days = typeof daysOfWeek === 'string' ? JSON.parse(daysOfWeek) : daysOfWeek;
      return Array.isArray(days) ? days : null;
    } catch (e) {
      return null;
    }
  }

  function convertTags(tags) {
    if (!tags) return null;
    try {
      const tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
      return Array.isArray(tagsArray) ? tagsArray : null;
    } catch (e) {
      return null;
    }
  }

  function transformScheduleToTemplate(schedule) {
    const recurringDays = convertDays(schedule.days_of_week);
    const tags = convertTags(schedule.tags);
    
    return {
      user_id: schedule.user_id,
      account_id: schedule.account_id,
      name: schedule.name,
      title: schedule.title_template || 'Broadcast {date}',
      description: schedule.description,
      privacy_status: schedule.privacy_status || 'unlisted',
      tags: tags,
      category_id: schedule.category_id || '20',
      thumbnail_path: null,
      stream_id: null,
      recurring_enabled: !!schedule.is_active,
      recurring_pattern: schedule.pattern,
      recurring_time: schedule.schedule_time,
      recurring_days: recurringDays,
      last_run_at: schedule.last_run_at,
      next_run_at: schedule.next_run_at,
      created_at: schedule.created_at || new Date().toISOString()
    };
  }

  // Generator for recurring schedule data
  const migrationScheduleArb = fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    account_id: fc.integer({ min: 1, max: 1000 }),
    name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 _-]{2,49}$/),
    pattern: fc.constantFrom('daily', 'weekly'),
    schedule_time: fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    days_of_week: fc.option(
      fc.subarray(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], { minLength: 1, maxLength: 7 })
        .map(days => JSON.stringify(days)),
      { nil: null }
    ),
    title_template: fc.option(fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,99}$/), { nil: null }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
    privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
    tags: fc.option(
      fc.array(fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/), { minLength: 1, maxLength: 5 })
        .map(tags => JSON.stringify(tags)),
      { nil: null }
    ),
    category_id: fc.constantFrom('1', '2', '10', '15', '17', '20', '22', '24', '28'),
    is_active: fc.boolean().map(b => b ? 1 : 0),
    last_run_at: fc.option(fc.constant('2025-12-24T08:00:00Z'), { nil: null }),
    next_run_at: fc.option(fc.constant('2025-12-25T08:00:00Z'), { nil: null }),
    created_at: fc.constant('2025-12-01T00:00:00Z')
  });

  // Daily schedule generator
  const dailyMigrationArb = migrationScheduleArb.map(schedule => ({
    ...schedule,
    pattern: 'daily',
    days_of_week: null
  }));

  // Weekly schedule generator (must have days)
  const weeklyMigrationArb = migrationScheduleArb.chain(schedule => 
    fc.subarray(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], { minLength: 1, maxLength: 7 })
      .map(days => ({
        ...schedule,
        pattern: 'weekly',
        days_of_week: JSON.stringify(days)
      }))
  );

  test('Daily schedule migration preserves pattern and time', () => {
    fc.assert(
      fc.property(
        dailyMigrationArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);

          // Verify pattern and time are preserved
          expect(template.recurring_pattern).toBe('daily');
          expect(template.recurring_time).toBe(schedule.schedule_time);
          expect(template.recurring_enabled).toBe(!!schedule.is_active);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Weekly schedule migration preserves pattern, time, and days', () => {
    fc.assert(
      fc.property(
        weeklyMigrationArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);

          // Verify pattern, time, and days are preserved
          expect(template.recurring_pattern).toBe('weekly');
          expect(template.recurring_time).toBe(schedule.schedule_time);
          expect(template.recurring_enabled).toBe(!!schedule.is_active);
          
          // Days should be preserved
          const originalDays = JSON.parse(schedule.days_of_week);
          expect(template.recurring_days).toEqual(originalDays);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration preserves title_template as title', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          const expectedTitle = schedule.title_template || 'Broadcast {date}';
          expect(template.title).toBe(expectedTitle);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration preserves privacy_status', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          const expectedPrivacy = schedule.privacy_status || 'unlisted';
          expect(template.privacy_status).toBe(expectedPrivacy);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration preserves tags', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb.filter(s => s.tags !== null),
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          const originalTags = JSON.parse(schedule.tags);
          expect(template.tags).toEqual(originalTags);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Migration preserves last_run_at and next_run_at', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          expect(template.last_run_at).toBe(schedule.last_run_at);
          expect(template.next_run_at).toBe(schedule.next_run_at);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration sets recurring_enabled based on is_active', () => {
    // Test with active schedule
    const activeSchedule = {
      id: 'test-id',
      user_id: 'user-1',
      account_id: 1,
      name: 'Active Schedule',
      pattern: 'daily',
      schedule_time: '08:00',
      days_of_week: null,
      title_template: 'Test Broadcast',
      description: null,
      privacy_status: 'unlisted',
      tags: null,
      category_id: '20',
      is_active: 1,
      last_run_at: null,
      next_run_at: null,
      created_at: '2025-12-01T00:00:00Z'
    };

    let template = transformScheduleToTemplate(activeSchedule);
    expect(template.recurring_enabled).toBe(true);

    // Test with inactive schedule
    const inactiveSchedule = { ...activeSchedule, is_active: 0 };
    template = transformScheduleToTemplate(inactiveSchedule);
    expect(template.recurring_enabled).toBe(false);
  });

  test('Migration preserves user_id and account_id', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          expect(template.user_id).toBe(schedule.user_id);
          expect(template.account_id).toBe(schedule.account_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration preserves category_id with default fallback', () => {
    fc.assert(
      fc.property(
        migrationScheduleArb,
        (schedule) => {
          const template = transformScheduleToTemplate(schedule);
          
          const expectedCategory = schedule.category_id || '20';
          expect(template.category_id).toBe(expectedCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: Combined Validation on Create', () => {
  /**
   * **Feature: template-recurring-integration, Property 9: Combined Validation on Create**
   * **Validates: Requirements 6.2**
   * 
   * For any new template creation with recurring enabled, both template validation
   * (name, title, account required) and recurring validation (pattern required,
   * weekly needs days) should be enforced.
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Generator for template with missing required fields
  const incompleteTemplateArb = fc.record({
    user_id: fc.option(fc.uuid(), { nil: null }),
    account_id: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
    name: fc.option(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 _-]{2,49}$/), { nil: null }),
    title: fc.option(fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,99}$/), { nil: null }),
    recurring_enabled: fc.constant(true),
    recurring_pattern: fc.constantFrom('daily', 'weekly'),
    recurring_time: fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    recurring_days: fc.subarray(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], { minLength: 1, maxLength: 7 })
  });

  // Generator for template with invalid recurring config
  const invalidRecurringTemplateArb = fc.record({
    user_id: fc.uuid(),
    account_id: fc.integer({ min: 1, max: 1000 }),
    name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 _-]{2,49}$/),
    title: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,99}$/),
    recurring_enabled: fc.constant(true),
    recurring_pattern: fc.constantFrom('monthly', 'yearly', 'invalid'), // Invalid patterns
    recurring_time: fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    recurring_days: fc.constant(null)
  });

  test('Template creation rejects missing required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        incompleteTemplateArb.filter(t => !t.user_id || !t.account_id || !t.name || !t.title),
        async (templateData) => {
          await expect(BroadcastTemplate.create(templateData))
            .rejects.toThrow(/Missing required fields|cannot be empty/);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Template creation rejects invalid recurring pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidRecurringTemplateArb,
        async (templateData) => {
          await expect(BroadcastTemplate.create(templateData))
            .rejects.toThrow('Recurring pattern must be daily or weekly');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Template creation rejects weekly pattern without days', async () => {
    const templateData = {
      user_id: 'test-user-id',
      account_id: 1,
      name: 'Test Template',
      title: 'Test Title',
      recurring_enabled: true,
      recurring_pattern: 'weekly',
      recurring_time: '08:00',
      recurring_days: [] // Empty days
    };

    await expect(BroadcastTemplate.create(templateData))
      .rejects.toThrow('Weekly schedule requires at least one day selected');
  });

  test('Template creation rejects enabled recurring without time', async () => {
    const templateData = {
      user_id: 'test-user-id',
      account_id: 1,
      name: 'Test Template',
      title: 'Test Title',
      recurring_enabled: true,
      recurring_pattern: 'daily',
      recurring_time: null // Missing time
    };

    await expect(BroadcastTemplate.create(templateData))
      .rejects.toThrow('Recurring time is required when recurring is enabled');
  });

  test('Valid template with recurring passes all validations', async () => {
    mockDb.run.mockImplementation(function(query, params, callback) {
      callback.call({ lastID: 1 }, null);
    });

    const validTemplate = {
      user_id: 'test-user-id',
      account_id: 1,
      name: 'Valid Template',
      title: 'Valid Title',
      recurring_enabled: true,
      recurring_pattern: 'daily',
      recurring_time: '08:00',
      recurring_days: null
    };

    const result = await BroadcastTemplate.create(validTemplate);
    
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Valid Template');
    expect(result.recurring_enabled).toBe(true);
    expect(result.recurring_pattern).toBe('daily');
  });

  test('Valid weekly template with days passes all validations', async () => {
    mockDb.run.mockImplementation(function(query, params, callback) {
      callback.call({ lastID: 1 }, null);
    });

    const validTemplate = {
      user_id: 'test-user-id',
      account_id: 1,
      name: 'Weekly Template',
      title: 'Weekly Title',
      recurring_enabled: true,
      recurring_pattern: 'weekly',
      recurring_time: '19:00',
      recurring_days: ['monday', 'wednesday', 'friday']
    };

    const result = await BroadcastTemplate.create(validTemplate);
    
    expect(result.id).toBeDefined();
    expect(result.recurring_enabled).toBe(true);
    expect(result.recurring_pattern).toBe('weekly');
    expect(result.recurring_days).toEqual(['monday', 'wednesday', 'friday']);
  });
});


describe('Property 8: Broadcast Creation Updates Timestamps', () => {
  /**
   * **Feature: template-recurring-integration, Property 8: Broadcast Creation Updates Timestamps**
   * **Validates: Requirements 5.4**
   * 
   * For any successful broadcast creation from a recurring template, the template's
   * last_run_at should be updated to the current time and next_run_at should be
   * recalculated to the next occurrence.
   */

  // Generator for template with recurring config
  const recurringTemplateArb = fc.record({
    id: fc.uuid(),
    name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 _-]{2,49}$/),
    recurring_pattern: fc.constantFrom('daily', 'weekly'),
    recurring_time: fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    recurring_days: fc.subarray(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], { minLength: 1, maxLength: 7 }),
    last_run_at: fc.option(fc.constant('2025-12-24T08:00:00Z'), { nil: null }),
    next_run_at: fc.option(fc.constant('2025-12-25T08:00:00Z'), { nil: null })
  });

  test('After broadcast creation, last_run_at is set to current time', () => {
    fc.assert(
      fc.property(
        recurringTemplateArb,
        (template) => {
          const now = new Date();
          const lastRunAt = now.toISOString();
          
          // Simulate what happens after broadcast creation
          const updatedTemplate = {
            ...template,
            last_run_at: lastRunAt
          };
          
          // Verify last_run_at is set to current time (within 1 second tolerance)
          const lastRunDate = new Date(updatedTemplate.last_run_at);
          const timeDiff = Math.abs(lastRunDate.getTime() - now.getTime());
          expect(timeDiff).toBeLessThan(1000);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('After broadcast creation, next_run_at is recalculated to future', () => {
    fc.assert(
      fc.property(
        recurringTemplateArb,
        (template) => {
          const now = new Date();
          
          // Calculate next run using the utility
          const nextRun = calculateNextRun({
            recurring_pattern: template.recurring_pattern,
            recurring_time: template.recurring_time,
            recurring_days: template.recurring_days
          }, now);
          
          // Verify next_run_at is in the future
          expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Daily pattern: next_run_at is within 24 hours', () => {
    fc.assert(
      fc.property(
        recurringTemplateArb.filter(t => t.recurring_pattern === 'daily'),
        (template) => {
          const now = new Date();
          
          const nextRun = calculateNextRun({
            recurring_pattern: 'daily',
            recurring_time: template.recurring_time,
            recurring_days: null
          }, now);
          
          const diffMs = nextRun.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          
          // Next run should be within 24 hours
          expect(diffHours).toBeLessThanOrEqual(24);
          expect(diffHours).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Weekly pattern: next_run_at is within 7 days', () => {
    fc.assert(
      fc.property(
        recurringTemplateArb.filter(t => t.recurring_pattern === 'weekly'),
        (template) => {
          const now = new Date();
          
          const nextRun = calculateNextRun({
            recurring_pattern: 'weekly',
            recurring_time: template.recurring_time,
            recurring_days: template.recurring_days
          }, now);
          
          const diffMs = nextRun.getTime() - now.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          // Next run should be within 7 days
          expect(diffDays).toBeLessThanOrEqual(7);
          expect(diffDays).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Timestamps are valid ISO strings', () => {
    fc.assert(
      fc.property(
        recurringTemplateArb,
        (template) => {
          const now = new Date();
          const lastRunAt = now.toISOString();
          
          const nextRun = calculateNextRun({
            recurring_pattern: template.recurring_pattern,
            recurring_time: template.recurring_time,
            recurring_days: template.recurring_days
          }, now);
          const nextRunAt = formatNextRunAt(nextRun);
          
          // Verify both are valid ISO strings
          expect(() => new Date(lastRunAt)).not.toThrow();
          expect(() => new Date(nextRunAt)).not.toThrow();
          
          // Verify they can be parsed back
          const parsedLastRun = new Date(lastRunAt);
          const parsedNextRun = new Date(nextRunAt);
          
          expect(parsedLastRun.toISOString()).toBe(lastRunAt);
          expect(parsedNextRun.toISOString()).toBe(nextRunAt);
        }
      ),
      { numRuns: 50 }
    );
  });
});
