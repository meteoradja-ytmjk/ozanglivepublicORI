/**
 * Property-based tests for Schedule Page feature
 * Feature: replace-history-with-schedule
 */

const fc = require('fast-check');

// Mock Stream model methods for testing
const Stream = {
  /**
   * Group streams by schedule type
   * @param {Array} streams - Array of stream objects
   * @returns {Object} Streams grouped by schedule_type
   */
  groupByScheduleType(streams) {
    return {
      once: streams.filter(s => s.schedule_type === 'once'),
      daily: streams.filter(s => s.schedule_type === 'daily'),
      weekly: streams.filter(s => s.schedule_type === 'weekly')
    };
  },

  /**
   * Filter streams scheduled for today
   * @param {Array} streams - Array of stream objects
   * @returns {Array} Streams scheduled for today, sorted by time
   */
  filterTodaySchedules(streams) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStreams = streams.filter(stream => {
      if (stream.schedule_type === 'once' && stream.schedule_time) {
        const scheduleDate = new Date(stream.schedule_time);
        return scheduleDate >= today && scheduleDate < tomorrow;
      }
      if (stream.schedule_type === 'daily' && stream.recurring_enabled) {
        return true;
      }
      if (stream.schedule_type === 'weekly' && stream.recurring_enabled) {
        const currentDay = now.getDay();
        const scheduleDays = Array.isArray(stream.schedule_days) ? stream.schedule_days : [];
        return scheduleDays.includes(currentDay);
      }
      return false;
    });

    return todayStreams.sort((a, b) => {
      const timeA = a.schedule_type === 'once' 
        ? new Date(a.schedule_time).getTime()
        : Stream.getTimeInMinutes(a.recurring_time);
      const timeB = b.schedule_type === 'once'
        ? new Date(b.schedule_time).getTime()
        : Stream.getTimeInMinutes(b.recurring_time);
      return timeA - timeB;
    });
  },

  /**
   * Convert HH:MM time string to minutes since midnight
   * @param {string} timeStr - Time string in HH:MM format
   * @returns {number} Minutes since midnight
   */
  getTimeInMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Calculate next scheduled time for a recurring stream
   * @param {Object} stream - Stream object
   * @returns {Date|null} Next scheduled time
   */
  getNextScheduledTime(stream) {
    if (!stream || !stream.recurring_time) {
      return null;
    }

    const now = new Date();
    const [hours, minutes] = stream.recurring_time.split(':').map(Number);

    if (stream.schedule_type === 'daily') {
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      return nextRun;
    }

    if (stream.schedule_type === 'weekly') {
      const scheduleDays = Array.isArray(stream.schedule_days) 
        ? stream.schedule_days 
        : [];
      
      if (scheduleDays.length === 0) {
        return null;
      }

      const sortedDays = [...scheduleDays].sort((a, b) => a - b);
      const currentDay = now.getDay();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const scheduleTime = hours * 60 + minutes;

      for (let i = 0; i < 7; i++) {
        const checkDay = (currentDay + i) % 7;
        if (sortedDays.includes(checkDay)) {
          const nextRun = new Date(now);
          nextRun.setDate(now.getDate() + i);
          nextRun.setHours(hours, minutes, 0, 0);
          
          if (i === 0 && scheduleTime <= currentTime) {
            continue;
          }
          return nextRun;
        }
      }

      const daysUntilNext = (7 - currentDay + sortedDays[0]) % 7 || 7;
      const nextRun = new Date(now);
      nextRun.setDate(now.getDate() + daysUntilNext);
      nextRun.setHours(hours, minutes, 0, 0);
      return nextRun;
    }

    return null;
  }
};

// Arbitraries for generating test data
const scheduleTypeArb = fc.constantFrom('once', 'daily', 'weekly');
const timeStringArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

const scheduleDaysArb = fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 0, maxLength: 7 })
  .map(days => [...new Set(days)].sort());

// Generate valid ISO date strings
const validDateArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([year, month, day, hour, minute]) => {
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  return d.toISOString();
});

const streamArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  schedule_type: scheduleTypeArb,
  schedule_time: fc.option(validDateArb, { nil: null }),
  recurring_time: fc.option(timeStringArb, { nil: null }),
  schedule_days: scheduleDaysArb,
  recurring_enabled: fc.boolean(),
  platform: fc.constantFrom('YouTube', 'Facebook', 'Twitch', 'Custom'),
  status: fc.constantFrom('offline', 'scheduled', 'live')
});

const streamsArrayArb = fc.array(streamArb, { minLength: 0, maxLength: 20 });

describe('Schedule Page - Property Tests', () => {
  /**
   * Property 1: Schedule grouping by type
   * For any list of streams with mixed schedule types, grouping them by schedule_type 
   * should result in each group containing only streams of that specific type, 
   * and the union of all groups should equal the original list.
   * 
   * **Feature: replace-history-with-schedule, Property 1: Schedule grouping by type**
   * **Validates: Requirements 2.1, 3.2**
   */
  describe('Property 1: Schedule grouping by type', () => {
    it('should group streams correctly by schedule_type', () => {
      fc.assert(
        fc.property(streamsArrayArb, (streams) => {
          const grouped = Stream.groupByScheduleType(streams);
          
          // Each group should only contain streams of that type
          expect(grouped.once.every(s => s.schedule_type === 'once')).toBe(true);
          expect(grouped.daily.every(s => s.schedule_type === 'daily')).toBe(true);
          expect(grouped.weekly.every(s => s.schedule_type === 'weekly')).toBe(true);
          
          // Union of all groups should equal original list length
          const totalGrouped = grouped.once.length + grouped.daily.length + grouped.weekly.length;
          expect(totalGrouped).toBe(streams.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all streams in grouping (no data loss)', () => {
      fc.assert(
        fc.property(streamsArrayArb, (streams) => {
          const grouped = Stream.groupByScheduleType(streams);
          const allGroupedIds = [
            ...grouped.once.map(s => s.id),
            ...grouped.daily.map(s => s.id),
            ...grouped.weekly.map(s => s.id)
          ];
          const originalIds = streams.map(s => s.id);
          
          expect(allGroupedIds.sort()).toEqual(originalIds.sort());
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 3: Next run time calculation for recurring streams
   * For any recurring stream (daily or weekly) with a valid recurring_time, 
   * the calculated next run time should be in the future and match the configured 
   * time and day constraints.
   * 
   * **Feature: replace-history-with-schedule, Property 3: Next run time calculation for recurring streams**
   * **Validates: Requirements 2.3**
   */
  describe('Property 3: Next run time calculation for recurring streams', () => {
    it('should calculate next run time in the future for daily streams', () => {
      fc.assert(
        fc.property(timeStringArb, (recurringTime) => {
          const stream = {
            schedule_type: 'daily',
            recurring_time: recurringTime,
            recurring_enabled: true
          };
          
          const nextRun = Stream.getNextScheduledTime(stream);
          const now = new Date();
          
          expect(nextRun).not.toBeNull();
          expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
          
          // Should match the configured time
          const [expectedHours, expectedMinutes] = recurringTime.split(':').map(Number);
          expect(nextRun.getHours()).toBe(expectedHours);
          expect(nextRun.getMinutes()).toBe(expectedMinutes);
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate next run time in the future for weekly streams', () => {
      fc.assert(
        fc.property(
          timeStringArb,
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
            .map(days => [...new Set(days)]),
          (recurringTime, scheduleDays) => {
            const stream = {
              schedule_type: 'weekly',
              recurring_time: recurringTime,
              schedule_days: scheduleDays,
              recurring_enabled: true
            };
            
            const nextRun = Stream.getNextScheduledTime(stream);
            const now = new Date();
            
            expect(nextRun).not.toBeNull();
            expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
            
            // Should match the configured time
            const [expectedHours, expectedMinutes] = recurringTime.split(':').map(Number);
            expect(nextRun.getHours()).toBe(expectedHours);
            expect(nextRun.getMinutes()).toBe(expectedMinutes);
            
            // Should be on one of the scheduled days
            expect(scheduleDays).toContain(nextRun.getDay());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for streams without recurring_time', () => {
      fc.assert(
        fc.property(scheduleTypeArb, (scheduleType) => {
          const stream = {
            schedule_type: scheduleType,
            recurring_time: null,
            recurring_enabled: true
          };
          
          const nextRun = Stream.getNextScheduledTime(stream);
          expect(nextRun).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Today's schedule chronological ordering
   * For any list of streams scheduled for today, sorting them by their scheduled time 
   * should produce a list where each stream's time is greater than or equal to 
   * the previous stream's time.
   * 
   * **Feature: replace-history-with-schedule, Property 4: Today's schedule chronological ordering**
   * **Validates: Requirements 4.2**
   */
  describe('Property 4: Today\'s schedule chronological ordering', () => {
    it('should sort today\'s schedules in chronological order', () => {
      // Generate streams that are definitely scheduled for today
      const todayStreamArb = fc.record({
        id: fc.uuid(),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        schedule_type: fc.constantFrom('daily', 'weekly'),
        recurring_time: timeStringArb,
        schedule_days: fc.constant([new Date().getDay()]), // Include today
        recurring_enabled: fc.constant(true),
        platform: fc.constantFrom('YouTube', 'Facebook'),
        status: fc.constantFrom('scheduled')
      });

      fc.assert(
        fc.property(fc.array(todayStreamArb, { minLength: 2, maxLength: 10 }), (streams) => {
          const todaySchedules = Stream.filterTodaySchedules(streams);
          
          // Check chronological ordering
          for (let i = 1; i < todaySchedules.length; i++) {
            const prevTime = Stream.getTimeInMinutes(todaySchedules[i - 1].recurring_time);
            const currTime = Stream.getTimeInMinutes(todaySchedules[i].recurring_time);
            expect(currTime).toBeGreaterThanOrEqual(prevTime);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Filter produces correct subset
   * For any list of streams and any valid filter value ('all', 'once', 'daily', 'weekly'), 
   * the filtered result should be a subset of the original list where all items 
   * match the filter criteria.
   * 
   * **Feature: replace-history-with-schedule, Property 5: Filter produces correct subset**
   * **Validates: Requirements 3.2**
   */
  describe('Property 5: Filter produces correct subset', () => {
    // Simulate the filter function from schedule.ejs
    function filterStreams(streams, filterValue) {
      if (filterValue === 'all') {
        return streams;
      }
      return streams.filter(s => s.schedule_type === filterValue);
    }

    it('should return all streams when filter is "all"', () => {
      fc.assert(
        fc.property(streamsArrayArb, (streams) => {
          const filtered = filterStreams(streams, 'all');
          expect(filtered.length).toBe(streams.length);
          expect(filtered).toEqual(streams);
        }),
        { numRuns: 100 }
      );
    });

    it('should return only matching streams for specific filter', () => {
      fc.assert(
        fc.property(
          streamsArrayArb,
          fc.constantFrom('once', 'daily', 'weekly'),
          (streams, filterValue) => {
            const filtered = filterStreams(streams, filterValue);
            
            // All filtered items should match the filter
            expect(filtered.every(s => s.schedule_type === filterValue)).toBe(true);
            
            // Filtered should be a subset of original
            expect(filtered.length).toBeLessThanOrEqual(streams.length);
            
            // All matching items from original should be in filtered
            const expectedCount = streams.filter(s => s.schedule_type === filterValue).length;
            expect(filtered.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
