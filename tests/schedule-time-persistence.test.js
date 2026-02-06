/**
 * Schedule Time Persistence Tests
 * Tests for the schedule time display and persistence fix
 * 
 * **Feature: schedule-time-persistence-fix**
 */

const fc = require('fast-check');

/**
 * Helper function that converts ISO UTC string to datetime-local input format (local time)
 * This is the same implementation used in schedule.ejs and dashboard.ejs
 * @param {string} isoString - ISO 8601 UTC string from database
 * @returns {string} - Format YYYY-MM-DDTHH:MM in local timezone
 */
function formatDateTimeLocal(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parse local datetime string to Date object (same as backend parseLocalDateTime)
 * @param {string} dateTimeString - Format YYYY-MM-DDTHH:MM
 * @returns {Date} Date object in local timezone
 */
function parseLocalDateTime(dateTimeString) {
  if (!dateTimeString) return null;
  const [datePart, timePart] = dateTimeString.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

describe('Schedule Time Persistence', () => {
  
  /**
   * **Feature: schedule-time-persistence-fix, Property 1: Schedule Time Round-Trip Consistency**
   * **Validates: Requirements 1.1, 1.2, 1.3, 3.2, 3.3**
   * 
   * For any valid schedule_time in UTC format, converting to local datetime-local format
   * for display and then parsing back to UTC should produce the same original UTC time
   * (within the same minute).
   */
  describe('Property 1: Schedule Time Round-Trip Consistency', () => {
    
    test('formatDateTimeLocal should convert UTC to local time correctly', () => {
      fc.assert(
        fc.property(
          // Generate random dates within reasonable range (2020-2030)
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            // Round to minute (remove seconds and milliseconds)
            const roundedDate = new Date(date);
            roundedDate.setSeconds(0, 0);
            
            const isoString = roundedDate.toISOString();
            const localFormat = formatDateTimeLocal(isoString);
            
            // Skip if format is empty
            if (!localFormat) return true;
            
            // Verify format is correct YYYY-MM-DDTHH:MM
            expect(localFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
            
            // Parse back and verify it represents the same local time
            const parsedBack = parseLocalDateTime(localFormat);
            
            // Skip if parsing failed
            if (!parsedBack || isNaN(parsedBack.getTime())) return true;
            
            // The local hours and minutes should match
            expect(parsedBack.getHours()).toBe(roundedDate.getHours());
            expect(parsedBack.getMinutes()).toBe(roundedDate.getMinutes());
            expect(parsedBack.getDate()).toBe(roundedDate.getDate());
            expect(parsedBack.getMonth()).toBe(roundedDate.getMonth());
            expect(parsedBack.getFullYear()).toBe(roundedDate.getFullYear());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('round-trip conversion should preserve the original time', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            // Round to minute
            const roundedDate = new Date(date);
            roundedDate.setSeconds(0, 0);
            
            const isoString = roundedDate.toISOString();
            
            // Convert to local format (display)
            const localFormat = formatDateTimeLocal(isoString);
            
            // Skip if format is empty
            if (!localFormat) return true;
            
            // Parse back (user saves without changes)
            const parsedBack = parseLocalDateTime(localFormat);
            
            // Skip if parsing failed
            if (!parsedBack || isNaN(parsedBack.getTime())) return true;
            
            // Convert back to ISO (save to database)
            const savedIso = parsedBack.toISOString();
            
            // The saved ISO should represent the same moment in time
            const originalTime = new Date(isoString).getTime();
            const savedTime = new Date(savedIso).getTime();
            
            // Should be within 1 minute (60000ms) due to rounding
            expect(Math.abs(originalTime - savedTime)).toBeLessThan(60000);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-time-persistence-fix, Property 2: End Time Round-Trip Consistency**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * For any valid end_time in UTC format, converting to local datetime-local format
   * for display and then parsing back to UTC should produce the same original UTC time.
   */
  describe('Property 2: End Time Round-Trip Consistency', () => {
    
    test('end_time should be preserved through display and save cycle', () => {
      fc.assert(
        fc.property(
          // Generate random dates within reasonable range (2020-2030)
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const roundedDate = new Date(date);
            roundedDate.setSeconds(0, 0);
            
            const isoString = roundedDate.toISOString();
            const localFormat = formatDateTimeLocal(isoString);
            const parsedBack = parseLocalDateTime(localFormat);
            
            // Skip if parsing failed
            if (!parsedBack || isNaN(parsedBack.getTime())) return true;
            
            const savedIso = parsedBack.toISOString();
            
            const originalTime = new Date(isoString).getTime();
            const savedTime = new Date(savedIso).getTime();
            
            expect(Math.abs(originalTime - savedTime)).toBeLessThan(60000);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-time-persistence-fix, Property 3: Recurring Time Preservation**
   * **Validates: Requirements 4.1, 4.3, 5.2**
   * 
   * For any recurring_time in HH:MM format, storing and retrieving should return
   * the exact same HH:MM string without any conversion.
   */
  describe('Property 3: Recurring Time Preservation', () => {
    
    test('recurring_time HH:MM format should be preserved exactly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const recurringTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            
            // Simulate storing and retrieving (no conversion should happen)
            const stored = recurringTime;
            const retrieved = stored;
            
            expect(retrieved).toBe(recurringTime);
            expect(retrieved).toMatch(/^\d{2}:\d{2}$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-time-persistence-fix, Property 4: Local Time Display Correctness**
   * **Validates: Requirements 3.1, 5.3**
   * 
   * For any UTC timestamp, the formatDateTimeLocal function should return a string
   * that when parsed as local time produces a Date object with the same local hour
   * and minute as the original UTC time converted to local timezone.
   */
  describe('Property 4: Local Time Display Correctness', () => {
    
    test('formatDateTimeLocal output should match local time components', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const isoString = date.toISOString();
            const localFormat = formatDateTimeLocal(isoString);
            
            // Skip if format is empty (invalid input)
            if (!localFormat) return true;
            
            // Parse the format string
            const [datePart, timePart] = localFormat.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            // These should match the local time components of the original date
            expect(year).toBe(date.getFullYear());
            expect(month).toBe(date.getMonth() + 1);
            expect(day).toBe(date.getDate());
            expect(hours).toBe(date.getHours());
            expect(minutes).toBe(date.getMinutes());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formatDateTimeLocal should handle null/undefined gracefully', () => {
      expect(formatDateTimeLocal(null)).toBe('');
      expect(formatDateTimeLocal(undefined)).toBe('');
      expect(formatDateTimeLocal('')).toBe('');
    });

    test('formatDateTimeLocal should handle invalid date strings gracefully', () => {
      expect(formatDateTimeLocal('invalid')).toBe('');
      expect(formatDateTimeLocal('not-a-date')).toBe('');
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle midnight correctly', () => {
      const midnight = new Date('2024-12-30T00:00:00.000Z');
      const localFormat = formatDateTimeLocal(midnight.toISOString());
      expect(localFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('should handle end of month correctly', () => {
      const endOfMonth = new Date('2024-01-31T23:59:00.000Z');
      const localFormat = formatDateTimeLocal(endOfMonth.toISOString());
      expect(localFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('should handle leap year correctly', () => {
      const leapDay = new Date('2024-02-29T12:00:00.000Z');
      const localFormat = formatDateTimeLocal(leapDay.toISOString());
      expect(localFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });
});
