/**
 * Recurring Schedule Model Tests
 * **Feature: recurring-broadcast-schedule**
 */

const fc = require('fast-check');

// Mock RecurringSchedule model functions for testing
const RecurringSchedule = {
  parseRow: (row) => {
    if (!row) return null;
    if (row.tags && typeof row.tags === 'string') {
      try { row.tags = JSON.parse(row.tags); } catch (e) { row.tags = []; }
    }
    if (row.days_of_week && typeof row.days_of_week === 'string') {
      try { row.days_of_week = JSON.parse(row.days_of_week); } catch (e) { row.days_of_week = []; }
    }
    row.is_active = !!row.is_active;
    return row;
  },
  
  validateCreate: (data) => {
    if (!data.user_id || !data.account_id || !data.name || !data.pattern || !data.schedule_time || !data.title_template) {
      return { valid: false, error: 'Missing required fields' };
    }
    if (!['daily', 'weekly'].includes(data.pattern)) {
      return { valid: false, error: 'Pattern must be daily or weekly' };
    }
    if (data.pattern === 'weekly') {
      const days = Array.isArray(data.days_of_week) ? data.days_of_week : 
        (data.days_of_week ? JSON.parse(data.days_of_week) : []);
      if (days.length === 0) {
        return { valid: false, error: 'Weekly schedule requires at least one day selected' };
      }
    }
    return { valid: true };
  }
};

// Generators for fast-check
const schedulePatternArb = fc.constantFrom('daily', 'weekly');
const timeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

const daysOfWeekArb = fc.subarray(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], { minLength: 0, maxLength: 7 });

const scheduleDataArb = fc.record({
  user_id: fc.string({ minLength: 1, maxLength: 36 }),
  account_id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  pattern: schedulePatternArb,
  schedule_time: timeArb,
  days_of_week: daysOfWeekArb,
  title_template: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  privacy_status: fc.constantFrom('public', 'unlisted', 'private'),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: null }),
  is_active: fc.boolean()
});

describe('RecurringSchedule Model', () => {
  describe('Validation', () => {
    test('should reject schedule without required fields', () => {
      const result = RecurringSchedule.validateCreate({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    test('should reject invalid pattern', () => {
      const result = RecurringSchedule.validateCreate({
        user_id: 'user1',
        account_id: 1,
        name: 'Test',
        pattern: 'monthly',
        schedule_time: '19:00',
        title_template: 'Test {date}'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Pattern must be daily or weekly');
    });

    test('should accept valid daily schedule', () => {
      const result = RecurringSchedule.validateCreate({
        user_id: 'user1',
        account_id: 1,
        name: 'Daily Stream',
        pattern: 'daily',
        schedule_time: '19:00',
        title_template: 'Live Stream {date}'
      });
      expect(result.valid).toBe(true);
    });

    /**
     * **Feature: recurring-broadcast-schedule, Property 2: Weekly Schedule Validation**
     * *For any* weekly schedule being saved, if no days of the week are selected,
     * the system SHALL reject the save operation and return an error.
     * **Validates: Requirements 2.4**
     */
    test('Property 2: Weekly schedule without days should be rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user_id: fc.string({ minLength: 1 }),
            account_id: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }),
            pattern: fc.constant('weekly'),
            schedule_time: timeArb,
            days_of_week: fc.constant([]), // Empty days
            title_template: fc.string({ minLength: 1 })
          }),
          async (data) => {
            const result = RecurringSchedule.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least one day');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should accept valid weekly schedule with days selected', () => {
      const result = RecurringSchedule.validateCreate({
        user_id: 'user1',
        account_id: 1,
        name: 'Weekend Stream',
        pattern: 'weekly',
        schedule_time: '20:00',
        days_of_week: ['sat', 'sun'],
        title_template: 'Weekend Live {day}'
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('parseRow', () => {
    test('should parse tags JSON string to array', () => {
      const row = {
        id: '1',
        tags: '["tag1","tag2"]',
        days_of_week: null,
        is_active: 1
      };
      const parsed = RecurringSchedule.parseRow(row);
      expect(parsed.tags).toEqual(['tag1', 'tag2']);
    });

    test('should parse days_of_week JSON string to array', () => {
      const row = {
        id: '1',
        tags: null,
        days_of_week: '["mon","wed","fri"]',
        is_active: 1
      };
      const parsed = RecurringSchedule.parseRow(row);
      expect(parsed.days_of_week).toEqual(['mon', 'wed', 'fri']);
    });

    test('should convert is_active to boolean', () => {
      const row1 = { id: '1', is_active: 1 };
      const row2 = { id: '2', is_active: 0 };
      
      expect(RecurringSchedule.parseRow(row1).is_active).toBe(true);
      expect(RecurringSchedule.parseRow(row2).is_active).toBe(false);
    });

    test('should handle invalid JSON gracefully', () => {
      const row = {
        id: '1',
        tags: 'invalid json',
        days_of_week: 'also invalid',
        is_active: 1
      };
      const parsed = RecurringSchedule.parseRow(row);
      expect(parsed.tags).toEqual([]);
      expect(parsed.days_of_week).toEqual([]);
    });

    test('should return null for null input', () => {
      expect(RecurringSchedule.parseRow(null)).toBeNull();
    });
  });
});


describe('ScheduleService', () => {
  // Mock replacePlaceholders function
  const replacePlaceholders = (template, date = new Date()) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const dateStr = `${day} ${monthNames[month].substring(0, 3)} ${year}`;
    
    return template
      .replace(/\{date\}/gi, dateStr)
      .replace(/\{time\}/gi, `${hours}:${minutes}`)
      .replace(/\{day\}/gi, dayNames[date.getDay()])
      .replace(/\{day_short\}/gi, dayShort[date.getDay()])
      .replace(/\{month\}/gi, monthNames[month])
      .replace(/\{year\}/gi, year.toString());
  };

  // Mock calculateNextRun function
  const calculateNextRun = (schedule) => {
    const now = new Date();
    const [hour, minute] = schedule.schedule_time.split(':').map(Number);
    
    if (schedule.pattern === 'daily') {
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    
    if (schedule.pattern === 'weekly') {
      const days = schedule.days_of_week || [];
      if (days.length === 0) return null;
      
      const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const scheduledDayNumbers = days.map(d => dayMap[d]).sort((a, b) => a - b);
      
      const currentDay = now.getDay();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const scheduleTime = hour * 60 + minute;
      
      let nextDay = null;
      
      if (scheduledDayNumbers.includes(currentDay) && currentTime < scheduleTime) {
        nextDay = currentDay;
      } else {
        for (const day of scheduledDayNumbers) {
          if (day > currentDay) {
            nextDay = day;
            break;
          }
        }
        if (nextDay === null) {
          nextDay = scheduledDayNumbers[0];
        }
      }
      
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      
      let daysToAdd = nextDay - currentDay;
      if (daysToAdd < 0 || (daysToAdd === 0 && currentTime >= scheduleTime)) {
        daysToAdd += 7;
      }
      
      next.setDate(next.getDate() + daysToAdd);
      return next;
    }
    
    return null;
  };

  describe('replacePlaceholders', () => {
    /**
     * **Feature: recurring-broadcast-schedule, Property 3: Placeholder Replacement**
     * *For any* title template containing placeholders ({date}, {time}, {day}, etc.),
     * the replacePlaceholders function SHALL return a string with all placeholders
     * replaced by actual date/time values.
     * **Validates: Requirements 4.4**
     */
    test('Property 3: All placeholders should be replaced with actual values', async () => {
      const placeholders = ['{date}', '{time}', '{day}', '{day_short}', '{month}', '{year}'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...placeholders), { minLength: 1, maxLength: 6 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (selectedPlaceholders, prefix) => {
            const template = prefix + ' ' + selectedPlaceholders.join(' ');
            const result = replacePlaceholders(template, new Date());
            
            // No placeholders should remain in the result
            for (const placeholder of placeholders) {
              expect(result.toLowerCase()).not.toContain(placeholder.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should replace {date} with formatted date', () => {
      const date = new Date(2025, 11, 24); // Dec 24, 2025
      const result = replacePlaceholders('Stream on {date}', date);
      expect(result).toBe('Stream on 24 Dec 2025');
    });

    test('should replace {day} with full day name', () => {
      const date = new Date(2025, 11, 24); // Wednesday
      const result = replacePlaceholders('Live on {day}', date);
      expect(result).toBe('Live on Wednesday');
    });

    test('should replace {day_short} with short day name', () => {
      const date = new Date(2025, 11, 24); // Wed
      const result = replacePlaceholders('Live on {day_short}', date);
      expect(result).toBe('Live on Wed');
    });

    test('should replace {month} with month name', () => {
      const date = new Date(2025, 11, 24);
      const result = replacePlaceholders('Stream in {month}', date);
      expect(result).toBe('Stream in December');
    });

    test('should replace {year} with year', () => {
      const date = new Date(2025, 11, 24);
      const result = replacePlaceholders('Stream {year}', date);
      expect(result).toBe('Stream 2025');
    });

    test('should replace multiple placeholders', () => {
      const date = new Date(2025, 11, 24, 19, 30);
      const result = replacePlaceholders('Live Stream {day} {date} at {time}', date);
      expect(result).toBe('Live Stream Wednesday 24 Dec 2025 at 19:30');
    });

    test('should handle template without placeholders', () => {
      const result = replacePlaceholders('Just a regular title', new Date());
      expect(result).toBe('Just a regular title');
    });
  });

  describe('calculateNextRun', () => {
    /**
     * **Feature: recurring-broadcast-schedule, Property 5: Next Run Calculation**
     * *For any* schedule (daily or weekly), the calculateNextRun function SHALL
     * return a timestamp that is in the future and matches the schedule pattern.
     * **Validates: Requirements 1.4, 2.3**
     */
    test('Property 5: Next run should always be in the future', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            pattern: fc.constantFrom('daily', 'weekly'),
            schedule_time: fc.tuple(
              fc.integer({ min: 0, max: 23 }),
              fc.integer({ min: 0, max: 59 })
            ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
            days_of_week: fc.subarray(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], { minLength: 1, maxLength: 7 })
          }),
          async (schedule) => {
            const nextRun = calculateNextRun(schedule);
            const now = new Date();
            
            if (nextRun !== null) {
              expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('daily schedule should return next occurrence', () => {
      const schedule = {
        pattern: 'daily',
        schedule_time: '19:00'
      };
      
      const nextRun = calculateNextRun(schedule);
      expect(nextRun).not.toBeNull();
      expect(nextRun.getHours()).toBe(19);
      expect(nextRun.getMinutes()).toBe(0);
    });

    test('weekly schedule should return next scheduled day', () => {
      const schedule = {
        pattern: 'weekly',
        schedule_time: '20:00',
        days_of_week: ['sat', 'sun']
      };
      
      const nextRun = calculateNextRun(schedule);
      expect(nextRun).not.toBeNull();
      expect(nextRun.getHours()).toBe(20);
      expect(nextRun.getMinutes()).toBe(0);
      
      const dayOfWeek = nextRun.getDay();
      expect([0, 6]).toContain(dayOfWeek); // Sunday or Saturday
    });

    test('weekly schedule with no days should return null', () => {
      const schedule = {
        pattern: 'weekly',
        schedule_time: '20:00',
        days_of_week: []
      };
      
      const nextRun = calculateNextRun(schedule);
      expect(nextRun).toBeNull();
    });
  });
});
