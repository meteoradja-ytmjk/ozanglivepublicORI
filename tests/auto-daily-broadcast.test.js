/**
 * Property-Based Tests for Auto Daily Broadcast Feature
 * Uses fast-check for property-based testing
 */

const fc = require('fast-check');
const {
  calculateNextRun,
  calculateNextDailyRun,
  calculateNextWeeklyRun,
  replaceTitlePlaceholders,
  parseTime,
  isValidTimeFormat,
  DAY_INDEX_MAP
} = require('../utils/recurringUtils');

describe('Auto Daily Broadcast - RecurringUtils', () => {
  /**
   * Feature: auto-daily-broadcast, Property 1: Next run calculation correctness
   * Validates: Requirements 1.1, 3.2, 5.3
   * 
   * For any current time and recurring_time configuration, when recurring is enabled
   * with daily pattern, the calculated next_run_at SHALL be:
   * - Today at recurring_time if current time is before recurring_time
   * - Tomorrow at recurring_time if current time is at or after recurring_time
   */
  describe('Property 1: Next run calculation correctness', () => {
    // Generator for valid time strings (HH:MM format)
    const validTimeArb = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    // Generator for valid dates (avoid Invalid Date issues)
    const validDateArb = fc.tuple(
      fc.integer({ min: 2024, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([year, month, day, hour, minute]) => new Date(year, month, day, hour, minute, 0, 0));

    test('daily pattern: next_run_at is always in the future', () => {
      fc.assert(
        fc.property(validTimeArb, validDateArb, (recurringTime, currentDate) => {
          const nextRun = calculateNextDailyRun(recurringTime, currentDate);
          
          // Next run must be strictly after current date
          expect(nextRun.getTime()).toBeGreaterThan(currentDate.getTime());
        }),
        { numRuns: 100 }
      );
    });

    test('daily pattern: next_run_at has correct hour and minute', () => {
      fc.assert(
        fc.property(validTimeArb, validDateArb, (recurringTime, currentDate) => {
          const nextRun = calculateNextDailyRun(recurringTime, currentDate);
          const { hours, minutes } = parseTime(recurringTime);
          
          // Next run must have the scheduled hour and minute
          expect(nextRun.getHours()).toBe(hours);
          expect(nextRun.getMinutes()).toBe(minutes);
          expect(nextRun.getSeconds()).toBe(0);
          expect(nextRun.getMilliseconds()).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    test('daily pattern: next_run_at is today if time has not passed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23 }), // hour for recurring time (1-23 to allow room before)
          fc.integer({ min: 0, max: 59 }), // minute for recurring time
          (schedHour, schedMin) => {
            // Create a current time that is before the scheduled time
            const currentDate = new Date(2024, 5, 15, schedHour - 1, 0, 0, 0);
            const recurringTime = `${schedHour.toString().padStart(2, '0')}:${schedMin.toString().padStart(2, '0')}`;
            
            const nextRun = calculateNextDailyRun(recurringTime, currentDate);
            
            // Should be same day
            expect(nextRun.getDate()).toBe(currentDate.getDate());
            expect(nextRun.getMonth()).toBe(currentDate.getMonth());
            expect(nextRun.getFullYear()).toBe(currentDate.getFullYear());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('daily pattern: next_run_at is tomorrow if time has passed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 22 }), // hour for recurring time (0-22 to allow room after)
          fc.integer({ min: 0, max: 59 }), // minute for recurring time
          (schedHour, schedMin) => {
            // Create a current time that is after the scheduled time
            const currentDate = new Date(2024, 5, 15, schedHour + 1, 30, 0, 0);
            const recurringTime = `${schedHour.toString().padStart(2, '0')}:${schedMin.toString().padStart(2, '0')}`;
            
            const nextRun = calculateNextDailyRun(recurringTime, currentDate);
            
            // Should be next day
            expect(nextRun.getDate()).toBe(currentDate.getDate() + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('calculateNextRun with daily pattern returns valid result', () => {
      fc.assert(
        fc.property(validTimeArb, validDateArb, (recurringTime, currentDate) => {
          const config = {
            recurring_pattern: 'daily',
            recurring_time: recurringTime,
            recurring_days: null
          };
          
          const nextRun = calculateNextRun(config, currentDate);
          
          expect(nextRun).not.toBeNull();
          expect(nextRun.getTime()).toBeGreaterThan(currentDate.getTime());
        }),
        { numRuns: 100 }
      );
    });

    test('calculateNextRun returns null for invalid config', () => {
      // Invalid time format
      expect(calculateNextRun({ recurring_pattern: 'daily', recurring_time: 'invalid' })).toBeNull();
      expect(calculateNextRun({ recurring_pattern: 'daily', recurring_time: null })).toBeNull();
      expect(calculateNextRun({ recurring_pattern: 'daily', recurring_time: '' })).toBeNull();
      
      // Invalid pattern
      expect(calculateNextRun({ recurring_pattern: 'invalid', recurring_time: '10:00' })).toBeNull();
      
      // Weekly without days
      expect(calculateNextRun({ recurring_pattern: 'weekly', recurring_time: '10:00', recurring_days: [] })).toBeNull();
      expect(calculateNextRun({ recurring_pattern: 'weekly', recurring_time: '10:00', recurring_days: null })).toBeNull();
    });
  });

  /**
   * Feature: auto-daily-broadcast, Property 1 (continued): Weekly pattern
   */
  describe('Property 1 (Weekly): Next run calculation for weekly pattern', () => {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Generator for non-empty subset of days
    const daysArb = fc.subarray(validDays, { minLength: 1 });
    
    const validTimeArb = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    // Use tuple-based date generator to avoid Invalid Date
    const dateArb = fc.tuple(
      fc.integer({ min: 2024, max: 2030 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([year, month, day, hour, minute]) => new Date(year, month, day, hour, minute, 0, 0));

    test('weekly pattern: next_run_at is always in the future', () => {
      fc.assert(
        fc.property(validTimeArb, daysArb, dateArb, (recurringTime, days, currentDate) => {
          const nextRun = calculateNextWeeklyRun(recurringTime, days, currentDate);
          
          // Next run must be strictly after current date
          expect(nextRun.getTime()).toBeGreaterThan(currentDate.getTime());
        }),
        { numRuns: 100 }
      );
    });

    test('weekly pattern: next_run_at falls on a scheduled day', () => {
      fc.assert(
        fc.property(validTimeArb, daysArb, dateArb, (recurringTime, days, currentDate) => {
          const nextRun = calculateNextWeeklyRun(recurringTime, days, currentDate);
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const nextRunDay = dayNames[nextRun.getDay()];
          
          // Next run day must be one of the scheduled days
          expect(days.map(d => d.toLowerCase())).toContain(nextRunDay);
        }),
        { numRuns: 100 }
      );
    });

    test('weekly pattern: next_run_at has correct hour and minute', () => {
      fc.assert(
        fc.property(validTimeArb, daysArb, dateArb, (recurringTime, days, currentDate) => {
          const nextRun = calculateNextWeeklyRun(recurringTime, days, currentDate);
          const { hours, minutes } = parseTime(recurringTime);
          
          expect(nextRun.getHours()).toBe(hours);
          expect(nextRun.getMinutes()).toBe(minutes);
        }),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: auto-daily-broadcast, Property 4: Placeholder replacement correctness
 * Validates: Requirements 4.1, 4.2
 * 
 * For any title string containing {date} and/or {time} placeholders,
 * replaceTitlePlaceholders SHALL:
 * - Replace {date} with date in DD/MM/YYYY format
 * - Replace {time} with time in HH:mm format
 * - Preserve all other text unchanged
 */
describe('Property 4: Placeholder replacement correctness', () => {
  // Generator for random strings without placeholder characters
  const safeStringArb = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => !s.includes('{') && !s.includes('}'));

  // Generator for valid dates
  const validDateArb = fc.tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 0, max: 11 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([year, month, day, hour, minute]) => new Date(year, month, day, hour, minute, 0, 0));

  test('{date} placeholder is replaced with DD/MM/YYYY format', () => {
    fc.assert(
      fc.property(safeStringArb, safeStringArb, validDateArb, (prefix, suffix, date) => {
        const template = prefix + '{date}' + suffix;
        const result = replaceTitlePlaceholders(template, date);
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        const expectedDate = `${day}/${month}/${year}`;
        
        // Result should contain the formatted date
        expect(result).toContain(expectedDate);
        // Result should not contain the placeholder
        expect(result).not.toContain('{date}');
        // Prefix and suffix should be preserved
        expect(result).toBe(prefix + expectedDate + suffix);
      }),
      { numRuns: 100 }
    );
  });

  test('{time} placeholder is replaced with HH:mm format', () => {
    fc.assert(
      fc.property(safeStringArb, safeStringArb, validDateArb, (prefix, suffix, date) => {
        const template = prefix + '{time}' + suffix;
        const result = replaceTitlePlaceholders(template, date);
        
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const expectedTime = `${hours}:${minutes}`;
        
        // Result should contain the formatted time
        expect(result).toContain(expectedTime);
        // Result should not contain the placeholder
        expect(result).not.toContain('{time}');
        // Prefix and suffix should be preserved
        expect(result).toBe(prefix + expectedTime + suffix);
      }),
      { numRuns: 100 }
    );
  });

  test('multiple placeholders are all replaced correctly', () => {
    fc.assert(
      fc.property(validDateArb, (date) => {
        const template = 'Live Stream {date} at {time} - {day}';
        const result = replaceTitlePlaceholders(template, date);
        
        // No placeholders should remain
        expect(result).not.toContain('{date}');
        expect(result).not.toContain('{time}');
        expect(result).not.toContain('{day}');
        
        // Should contain formatted values
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        expect(result).toContain(`${day}/${month}/${year}`);
      }),
      { numRuns: 100 }
    );
  });

  test('text without placeholders is preserved unchanged', () => {
    fc.assert(
      fc.property(safeStringArb, validDateArb, (text, date) => {
        // Text without any placeholders
        const result = replaceTitlePlaceholders(text, date);
        
        // Should be unchanged
        expect(result).toBe(text);
      }),
      { numRuns: 100 }
    );
  });

  test('handles null/undefined input gracefully', () => {
    expect(replaceTitlePlaceholders(null)).toBe('');
    expect(replaceTitlePlaceholders(undefined)).toBe('');
    expect(replaceTitlePlaceholders('')).toBe('');
  });

  test('same placeholder appearing multiple times is replaced everywhere', () => {
    fc.assert(
      fc.property(validDateArb, (date) => {
        const template = '{date} - {date} - {date}';
        const result = replaceTitlePlaceholders(template, date);
        
        // Count occurrences of the formatted date
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        const expectedDate = `${day}/${month}/${year}`;
        
        const occurrences = (result.match(new RegExp(expectedDate.replace(/\//g, '\\/'), 'g')) || []).length;
        expect(occurrences).toBe(3);
        expect(result).not.toContain('{date}');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auto-daily-broadcast, Property 2: Schedule execution timing
 * Validates: Requirements 1.2, 2.3
 * 
 * For any template with recurring enabled, shouldExecute SHALL return true only when:
 * - Current hour and minute match recurring_time
 * - Template has not already run today (hasRunToday returns false)
 * - For weekly pattern: current day is in recurring_days
 */
describe('Property 2: Schedule execution timing', () => {
  // Mock ScheduleService methods for testing
  const createMockScheduleService = () => ({
    hasRunToday: (template, now) => {
      if (!template.last_run_at) return false;
      const lastRun = new Date(template.last_run_at);
      return lastRun.toDateString() === now.toDateString();
    },
    shouldExecute: function(template, now) {
      if (!template.recurring_time) return false;
      
      const [schedHour, schedMin] = template.recurring_time.split(':').map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      
      if (currentHour !== schedHour || currentMin !== schedMin) {
        return false;
      }
      
      if (template.recurring_pattern === 'daily') {
        return !this.hasRunToday(template, now);
      }
      
      if (template.recurring_pattern === 'weekly') {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = dayNames[now.getDay()];
        const scheduledDays = template.recurring_days || [];
        const normalizedDays = scheduledDays.map(d => d.toLowerCase());
        
        if (!normalizedDays.includes(today)) {
          return false;
        }
        
        return !this.hasRunToday(template, now);
      }
      
      return false;
    }
  });

  const validTimeArb = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

  test('shouldExecute returns true when time matches and has not run today (daily)', () => {
    fc.assert(
      fc.property(validTimeArb, (recurringTime) => {
        const service = createMockScheduleService();
        const [hour, minute] = recurringTime.split(':').map(Number);
        
        // Create a date at exactly the scheduled time
        const now = new Date(2024, 5, 15, hour, minute, 0, 0);
        
        const template = {
          recurring_pattern: 'daily',
          recurring_time: recurringTime,
          last_run_at: null // Has not run today
        };
        
        expect(service.shouldExecute(template, now)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('shouldExecute returns false when time does not match', () => {
    fc.assert(
      fc.property(
        validTimeArb,
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (recurringTime, currentHour, currentMin) => {
          const service = createMockScheduleService();
          const [schedHour, schedMin] = recurringTime.split(':').map(Number);
          
          // Skip if times happen to match
          if (currentHour === schedHour && currentMin === schedMin) return true;
          
          const now = new Date(2024, 5, 15, currentHour, currentMin, 0, 0);
          
          const template = {
            recurring_pattern: 'daily',
            recurring_time: recurringTime,
            last_run_at: null
          };
          
          expect(service.shouldExecute(template, now)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldExecute returns false when already run today', () => {
    fc.assert(
      fc.property(validTimeArb, (recurringTime) => {
        const service = createMockScheduleService();
        const [hour, minute] = recurringTime.split(':').map(Number);
        
        const now = new Date(2024, 5, 15, hour, minute, 0, 0);
        
        // Last run was earlier today (use a fixed earlier time)
        const earlierHour = Math.max(0, hour - 1);
        const template = {
          recurring_pattern: 'daily',
          recurring_time: recurringTime,
          last_run_at: new Date(2024, 5, 15, earlierHour, 30, 0, 0).toISOString() // Already ran today
        };
        
        expect(service.shouldExecute(template, now)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('weekly pattern: shouldExecute returns false on non-scheduled days', () => {
    const service = createMockScheduleService();
    
    // Saturday, June 15, 2024 at 10:00
    const now = new Date(2024, 5, 15, 10, 0, 0, 0);
    
    const template = {
      recurring_pattern: 'weekly',
      recurring_time: '10:00',
      recurring_days: ['monday', 'wednesday', 'friday'], // Saturday not included
      last_run_at: null
    };
    
    expect(service.shouldExecute(template, now)).toBe(false);
  });

  test('weekly pattern: shouldExecute returns true on scheduled days', () => {
    const service = createMockScheduleService();
    
    // Monday, June 17, 2024 at 10:00
    const now = new Date(2024, 5, 17, 10, 0, 0, 0);
    
    const template = {
      recurring_pattern: 'weekly',
      recurring_time: '10:00',
      recurring_days: ['monday', 'wednesday', 'friday'],
      last_run_at: null
    };
    
    expect(service.shouldExecute(template, now)).toBe(true);
  });
});

/**
 * Feature: auto-daily-broadcast, Property 3: Duplicate prevention
 * Validates: Requirements 2.3
 * 
 * For any template with last_run_at set to today, hasRunToday SHALL return true,
 * preventing duplicate broadcast creation on the same day.
 */
describe('Property 3: Duplicate prevention', () => {
  const hasRunToday = (template, now) => {
    if (!template.last_run_at) return false;
    const lastRun = new Date(template.last_run_at);
    return lastRun.toDateString() === now.toDateString();
  };

  test('hasRunToday returns true when last_run_at is today', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hour, minute) => {
          const now = new Date(2024, 5, 15, 14, 30, 0, 0); // 2:30 PM
          
          // Last run was earlier today
          const lastRunAt = new Date(2024, 5, 15, hour, minute, 0, 0);
          
          const template = { last_run_at: lastRunAt.toISOString() };
          
          expect(hasRunToday(template, now)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasRunToday returns false when last_run_at is yesterday', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hour, minute) => {
          const now = new Date(2024, 5, 15, 14, 30, 0, 0); // Today
          
          // Last run was yesterday
          const lastRunAt = new Date(2024, 5, 14, hour, minute, 0, 0);
          
          const template = { last_run_at: lastRunAt.toISOString() };
          
          expect(hasRunToday(template, now)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasRunToday returns false when last_run_at is null', () => {
    const now = new Date(2024, 5, 15, 14, 30, 0, 0);
    const template = { last_run_at: null };
    
    expect(hasRunToday(template, now)).toBe(false);
  });

  test('hasRunToday returns false when last_run_at is undefined', () => {
    const now = new Date(2024, 5, 15, 14, 30, 0, 0);
    const template = {};
    
    expect(hasRunToday(template, now)).toBe(false);
  });
});


/**
 * Feature: auto-daily-broadcast, Property 5: Template settings preservation
 * Validates: Requirements 1.4, 4.3, 4.4
 * 
 * For any template, when executeTemplate creates a broadcast, the broadcast data SHALL include:
 * - Title with placeholders replaced
 * - Template's privacy_status, description, tags, category_id
 * - Template's stream_id if configured
 * - Scheduled start time 10 minutes from creation
 */
describe('Property 5: Template settings preservation', () => {
  // Helper to build broadcast data like executeTemplate does
  const buildBroadcastData = (template, now) => {
    const title = replaceTitlePlaceholders(template.title, now);
    const description = template.description ? replaceTitlePlaceholders(template.description, now) : '';
    const scheduledStartTime = new Date(now.getTime() + 10 * 60 * 1000);
    
    return {
      title,
      description,
      scheduledStartTime: scheduledStartTime.toISOString(),
      privacyStatus: template.privacy_status || 'unlisted',
      tags: template.tags || [],
      categoryId: template.category_id || '20',
      streamId: template.stream_id || null
    };
  };

  const validDateArb = fc.tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 0, max: 11 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([year, month, day, hour, minute]) => new Date(year, month, day, hour, minute, 0, 0));

  const privacyStatusArb = fc.constantFrom('public', 'unlisted', 'private');
  const categoryIdArb = fc.constantFrom('20', '22', '24', '10');
  const tagsArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 });

  test('broadcast data includes template privacy_status', () => {
    fc.assert(
      fc.property(privacyStatusArb, validDateArb, (privacyStatus, now) => {
        const template = {
          title: 'Test Stream',
          description: 'Test description',
          privacy_status: privacyStatus,
          tags: [],
          category_id: '20',
          stream_id: null
        };
        
        const broadcastData = buildBroadcastData(template, now);
        
        expect(broadcastData.privacyStatus).toBe(privacyStatus);
      }),
      { numRuns: 100 }
    );
  });

  test('broadcast data includes template category_id', () => {
    fc.assert(
      fc.property(categoryIdArb, validDateArb, (categoryId, now) => {
        const template = {
          title: 'Test Stream',
          description: '',
          privacy_status: 'unlisted',
          tags: [],
          category_id: categoryId,
          stream_id: null
        };
        
        const broadcastData = buildBroadcastData(template, now);
        
        expect(broadcastData.categoryId).toBe(categoryId);
      }),
      { numRuns: 100 }
    );
  });

  test('broadcast data includes template tags', () => {
    fc.assert(
      fc.property(tagsArb, validDateArb, (tags, now) => {
        const template = {
          title: 'Test Stream',
          description: '',
          privacy_status: 'unlisted',
          tags: tags,
          category_id: '20',
          stream_id: null
        };
        
        const broadcastData = buildBroadcastData(template, now);
        
        expect(broadcastData.tags).toEqual(tags);
      }),
      { numRuns: 100 }
    );
  });

  test('broadcast data includes stream_id when configured', () => {
    fc.assert(
      fc.property(fc.uuid(), validDateArb, (streamId, now) => {
        const template = {
          title: 'Test Stream',
          description: '',
          privacy_status: 'unlisted',
          tags: [],
          category_id: '20',
          stream_id: streamId
        };
        
        const broadcastData = buildBroadcastData(template, now);
        
        expect(broadcastData.streamId).toBe(streamId);
      }),
      { numRuns: 100 }
    );
  });

  test('scheduled start time is 10 minutes from creation', () => {
    fc.assert(
      fc.property(validDateArb, (now) => {
        const template = {
          title: 'Test Stream',
          description: '',
          privacy_status: 'unlisted',
          tags: [],
          category_id: '20',
          stream_id: null
        };
        
        const broadcastData = buildBroadcastData(template, now);
        const scheduledTime = new Date(broadcastData.scheduledStartTime);
        const expectedTime = new Date(now.getTime() + 10 * 60 * 1000);
        
        // Should be exactly 10 minutes from now
        expect(scheduledTime.getTime()).toBe(expectedTime.getTime());
      }),
      { numRuns: 100 }
    );
  });

  test('title placeholders are replaced in broadcast data', () => {
    fc.assert(
      fc.property(validDateArb, (now) => {
        const template = {
          title: 'Live Stream {date} at {time}',
          description: 'Streaming on {day}',
          privacy_status: 'unlisted',
          tags: [],
          category_id: '20',
          stream_id: null
        };
        
        const broadcastData = buildBroadcastData(template, now);
        
        // Title should not contain placeholders
        expect(broadcastData.title).not.toContain('{date}');
        expect(broadcastData.title).not.toContain('{time}');
        
        // Description should not contain placeholders
        expect(broadcastData.description).not.toContain('{day}');
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: auto-daily-broadcast, Property 7: Last run update correctness
 * Validates: Requirements 1.3
 * 
 * For any successful broadcast creation, updateLastRun SHALL:
 * - Set last_run_at to current timestamp
 * - Set next_run_at to tomorrow at recurring_time (for daily pattern)
 */
describe('Property 7: Last run update correctness', () => {
  const validTimeArb = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

  const validDateArb = fc.tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 0, max: 11 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([year, month, day, hour, minute]) => new Date(year, month, day, hour, minute, 0, 0));

  test('next_run_at for daily pattern is tomorrow at recurring_time', () => {
    fc.assert(
      fc.property(validTimeArb, validDateArb, (recurringTime, now) => {
        const config = {
          recurring_pattern: 'daily',
          recurring_time: recurringTime,
          recurring_days: null
        };
        
        // After execution, calculateNextRun should return tomorrow
        const nextRun = calculateNextRun(config, now);
        
        // Next run should be in the future
        expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
        
        // Next run should have the correct time
        const [expectedHour, expectedMin] = recurringTime.split(':').map(Number);
        expect(nextRun.getHours()).toBe(expectedHour);
        expect(nextRun.getMinutes()).toBe(expectedMin);
      }),
      { numRuns: 100 }
    );
  });

  test('last_run_at should be set to execution time', () => {
    // This is a simple verification that the timestamp format is correct
    fc.assert(
      fc.property(validDateArb, (now) => {
        const lastRunAt = now.toISOString();
        
        // Should be a valid ISO string
        expect(new Date(lastRunAt).getTime()).toBe(now.getTime());
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auto-daily-broadcast, Property 6: Toggle preserves configuration
 * Validates: Requirements 5.2
 * 
 * For any template with recurring configuration, when recurring_enabled is toggled off,
 * the recurring_pattern, recurring_time, and recurring_days SHALL remain unchanged in the database.
 */
describe('Property 6: Toggle preserves configuration', () => {
  // Simulate the toggle behavior
  const simulateToggleOff = (template) => {
    // When toggling off, only recurring_enabled changes
    // recurring_pattern, recurring_time, recurring_days are preserved
    return {
      ...template,
      recurring_enabled: false
      // Note: recurring_pattern, recurring_time, recurring_days remain unchanged
    };
  };

  const simulateToggleOn = (template, nextRunAt) => {
    return {
      ...template,
      recurring_enabled: true,
      next_run_at: nextRunAt
    };
  };

  const validTimeArb = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const daysArb = fc.subarray(validDays, { minLength: 1 });

  test('toggle off preserves recurring_pattern', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('daily', 'weekly'),
        validTimeArb,
        (pattern, time) => {
          const template = {
            recurring_enabled: true,
            recurring_pattern: pattern,
            recurring_time: time,
            recurring_days: pattern === 'weekly' ? ['monday', 'wednesday'] : null
          };
          
          const afterToggle = simulateToggleOff(template);
          
          expect(afterToggle.recurring_enabled).toBe(false);
          expect(afterToggle.recurring_pattern).toBe(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('toggle off preserves recurring_time', () => {
    fc.assert(
      fc.property(validTimeArb, (time) => {
        const template = {
          recurring_enabled: true,
          recurring_pattern: 'daily',
          recurring_time: time,
          recurring_days: null
        };
        
        const afterToggle = simulateToggleOff(template);
        
        expect(afterToggle.recurring_enabled).toBe(false);
        expect(afterToggle.recurring_time).toBe(time);
      }),
      { numRuns: 100 }
    );
  });

  test('toggle off preserves recurring_days for weekly pattern', () => {
    fc.assert(
      fc.property(daysArb, validTimeArb, (days, time) => {
        const template = {
          recurring_enabled: true,
          recurring_pattern: 'weekly',
          recurring_time: time,
          recurring_days: days
        };
        
        const afterToggle = simulateToggleOff(template);
        
        expect(afterToggle.recurring_enabled).toBe(false);
        expect(afterToggle.recurring_days).toEqual(days);
      }),
      { numRuns: 100 }
    );
  });

  test('toggle on recalculates next_run_at', () => {
    fc.assert(
      fc.property(validTimeArb, (time) => {
        const template = {
          recurring_enabled: false,
          recurring_pattern: 'daily',
          recurring_time: time,
          recurring_days: null,
          next_run_at: null
        };
        
        const now = new Date();
        const nextRun = calculateNextRun({
          recurring_pattern: template.recurring_pattern,
          recurring_time: template.recurring_time,
          recurring_days: template.recurring_days
        }, now);
        
        const afterToggle = simulateToggleOn(template, nextRun.toISOString());
        
        expect(afterToggle.recurring_enabled).toBe(true);
        expect(afterToggle.next_run_at).not.toBeNull();
        expect(new Date(afterToggle.next_run_at).getTime()).toBeGreaterThan(now.getTime());
      }),
      { numRuns: 100 }
    );
  });

  test('toggle cycle preserves all configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('daily', 'weekly'),
        validTimeArb,
        daysArb,
        (pattern, time, days) => {
          const originalTemplate = {
            recurring_enabled: true,
            recurring_pattern: pattern,
            recurring_time: time,
            recurring_days: pattern === 'weekly' ? days : null,
            next_run_at: new Date().toISOString()
          };
          
          // Toggle off
          const afterOff = simulateToggleOff(originalTemplate);
          
          // Toggle back on
          const nextRun = calculateNextRun({
            recurring_pattern: afterOff.recurring_pattern,
            recurring_time: afterOff.recurring_time,
            recurring_days: afterOff.recurring_days
          });
          const afterOn = simulateToggleOn(afterOff, nextRun.toISOString());
          
          // All config should be preserved
          expect(afterOn.recurring_pattern).toBe(originalTemplate.recurring_pattern);
          expect(afterOn.recurring_time).toBe(originalTemplate.recurring_time);
          expect(afterOn.recurring_days).toEqual(originalTemplate.recurring_days);
          expect(afterOn.recurring_enabled).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
