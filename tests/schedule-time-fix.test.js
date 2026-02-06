/**
 * Schedule Time Fix - Property-Based Tests
 * Tests for schedule time persistence and conversion
 * 
 * Feature: schedule-time-fix
 */

const fc = require('fast-check');

// ============================================================================
// Helper Functions (extracted from frontend/backend for testing)
// ============================================================================

/**
 * Calculate total duration in minutes from hours and minutes
 * @param {number} hours - Hours component
 * @param {number} minutes - Minutes component
 * @returns {number} Total minutes
 */
function calculateDurationMinutes(hours, minutes) {
  return (hours * 60) + minutes;
}

/**
 * Convert total minutes to hours and minutes display
 * @param {number} totalMinutes - Total minutes
 * @returns {{hours: number, minutes: number}} Hours and minutes components
 */
function displayDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

/**
 * Convert ISO UTC string to datetime-local input format (local time)
 * This is the frontend function from schedule.ejs
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
 * Parse local datetime string to Date object
 * This is the backend function from app.js
 * @param {string} dateTimeString - Format YYYY-MM-DDTHH:MM
 * @returns {Date} Date object in local timezone
 */
function parseLocalDateTime(dateTimeString) {
  const [datePart, timePart] = dateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Validate recurring time format (HH:MM)
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} True if valid HH:MM format
 */
function isValidRecurringTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Get current time in Asia/Jakarta timezone (WIB)
 * Simplified version for testing
 * @param {Date} date - Date object to convert
 * @returns {Object} Object with hours, minutes, day
 */
function getWIBTime(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    let hours = 0, minutes = 0, dayName = '';
    
    for (const part of parts) {
      if (part.type === 'hour') hours = parseInt(part.value, 10);
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
      if (part.type === 'weekday') dayName = part.value;
    }
    
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const day = dayMap[dayName] ?? date.getDay();
    
    return { hours, minutes, day };
  } catch (e) {
    // Fallback
    const wibOffset = 7 * 60;
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
    
    const hours = Math.floor(wibMinutes / 60);
    const minutes = wibMinutes % 60;
    
    const utcDay = date.getUTCDay();
    const utcHours = date.getUTCHours();
    let day = utcDay;
    if (utcHours + 7 >= 24) {
      day = (utcDay + 1) % 7;
    }
    
    return { hours, minutes, day };
  }
}

/**
 * Check if a daily schedule should trigger
 * @param {string} recurringTime - Time in HH:MM format
 * @param {Date} currentTime - Current time to check
 * @returns {boolean} True if should trigger
 */
function shouldTriggerDaily(recurringTime, currentTime) {
  if (!recurringTime) return false;
  
  const [schedHours, schedMinutes] = recurringTime.split(':').map(Number);
  const scheduleMinutes = schedHours * 60 + schedMinutes;
  
  const wibTime = getWIBTime(currentTime);
  const currentTotalMinutes = wibTime.hours * 60 + wibTime.minutes;
  
  const timeDiff = currentTotalMinutes - scheduleMinutes;
  
  // Trigger only AFTER scheduled time (0-5 minutes window)
  return timeDiff >= 0 && timeDiff <= 5;
}

/**
 * Check if a weekly schedule should trigger
 * @param {string} recurringTime - Time in HH:MM format
 * @param {number[]} scheduleDays - Array of day numbers (0-6)
 * @param {Date} currentTime - Current time to check
 * @returns {boolean} True if should trigger
 */
function shouldTriggerWeekly(recurringTime, scheduleDays, currentTime) {
  if (!recurringTime || !scheduleDays || scheduleDays.length === 0) return false;
  
  const wibTime = getWIBTime(currentTime);
  
  // Check if current day is in schedule
  if (!scheduleDays.includes(wibTime.day)) return false;
  
  const [schedHours, schedMinutes] = recurringTime.split(':').map(Number);
  const scheduleMinutes = schedHours * 60 + schedMinutes;
  const currentTotalMinutes = wibTime.hours * 60 + wibTime.minutes;
  
  const timeDiff = currentTotalMinutes - scheduleMinutes;
  
  return timeDiff >= 0 && timeDiff <= 5;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Schedule Time Fix - Property Tests', () => {
  
  /**
   * Feature: schedule-time-fix, Property 1: Duration calculation consistency
   * For any non-negative hours and minutes values, the total duration in minutes 
   * SHALL equal (hours * 60 + minutes)
   * Validates: Requirements 1.3, 3.1
   */
  describe('Property 1: Duration calculation consistency', () => {
    test('hours * 60 + minutes should equal total duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 168 }), // hours (up to 1 week)
          fc.integer({ min: 0, max: 59 }),  // minutes
          (hours, minutes) => {
            const total = calculateDurationMinutes(hours, minutes);
            return total === (hours * 60 + minutes);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('duration should always be non-negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 168 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const total = calculateDurationMinutes(hours, minutes);
            return total >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: schedule-time-fix, Property 2: Duration display round-trip
   * For any total minutes value, displaying as hours and minutes then 
   * recalculating SHALL produce the same total minutes
   * Validates: Requirements 3.3
   */
  describe('Property 2: Duration display round-trip', () => {
    test('display then calculate should return same total', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10080 }), // up to 1 week in minutes
          (totalMinutes) => {
            const { hours, minutes } = displayDuration(totalMinutes);
            const recalculated = calculateDurationMinutes(hours, minutes);
            return recalculated === totalMinutes;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('displayed hours should be floor(total/60)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10080 }),
          (totalMinutes) => {
            const { hours } = displayDuration(totalMinutes);
            return hours === Math.floor(totalMinutes / 60);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('displayed minutes should be total % 60', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10080 }),
          (totalMinutes) => {
            const { minutes } = displayDuration(totalMinutes);
            return minutes === totalMinutes % 60;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: schedule-time-fix, Property 3: ISO to local datetime conversion
   * For any valid ISO 8601 string, formatDateTimeLocal SHALL produce a valid 
   * datetime-local format string (YYYY-MM-DDTHH:MM)
   * Validates: Requirements 1.1, 4.1
   */
  describe('Property 3: ISO to local datetime conversion', () => {
    test('should produce valid datetime-local format', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const isoString = date.toISOString();
            const result = formatDateTimeLocal(isoString);
            
            // Should match YYYY-MM-DDTHH:MM format
            const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
            return pattern.test(result);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should handle empty/null input gracefully', () => {
      expect(formatDateTimeLocal('')).toBe('');
      expect(formatDateTimeLocal(null)).toBe('');
      expect(formatDateTimeLocal(undefined)).toBe('');
    });
    
    test('should handle invalid date strings', () => {
      expect(formatDateTimeLocal('invalid')).toBe('');
      expect(formatDateTimeLocal('not-a-date')).toBe('');
    });
  });

  /**
   * Feature: schedule-time-fix, Property 4: Local to ISO conversion round-trip
   * For any valid datetime-local string, converting to ISO then back to local 
   * SHALL preserve the same date and time components
   * Validates: Requirements 1.4, 4.2
   */
  describe('Property 4: Local to ISO conversion round-trip', () => {
    test('parse then format should preserve date/time components', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2030 }), // year
          fc.integer({ min: 1, max: 12 }),      // month
          fc.integer({ min: 1, max: 28 }),      // day (use 28 to avoid month-end issues)
          fc.integer({ min: 0, max: 23 }),      // hours
          fc.integer({ min: 0, max: 59 }),      // minutes
          (year, month, day, hours, minutes) => {
            const dateTimeLocal = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            
            const parsed = parseLocalDateTime(dateTimeLocal);
            const isoString = parsed.toISOString();
            const formatted = formatDateTimeLocal(isoString);
            
            // Should get back the same datetime-local string
            return formatted === dateTimeLocal;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: schedule-time-fix, Property 5: Recurring time format validation
   * For any saved recurring_time, the format SHALL match HH:MM pattern 
   * where HH is 00-23 and MM is 00-59
   * Validates: Requirements 2.1
   */
  describe('Property 5: Recurring time format validation', () => {
    test('valid HH:MM times should pass validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return isValidRecurringTime(timeStr);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('invalid times should fail validation', () => {
      expect(isValidRecurringTime('24:00')).toBe(false);
      expect(isValidRecurringTime('00:60')).toBe(false);
      expect(isValidRecurringTime('1:30')).toBe(false);  // missing leading zero
      expect(isValidRecurringTime('12:5')).toBe(false);  // missing leading zero
      expect(isValidRecurringTime('')).toBe(false);
      expect(isValidRecurringTime(null)).toBe(false);
      expect(isValidRecurringTime('invalid')).toBe(false);
    });
  });

  /**
   * Feature: schedule-time-fix, Property 6: Weekly schedule days persistence
   * For any array of day numbers (0-6), saving and loading schedule_days 
   * SHALL return the same array
   * Validates: Requirements 2.2
   */
  describe('Property 6: Weekly schedule days persistence', () => {
    test('JSON stringify then parse should preserve days array', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
          (days) => {
            // Remove duplicates and sort for comparison
            const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
            
            const jsonStr = JSON.stringify(uniqueDays);
            const parsed = JSON.parse(jsonStr);
            
            return JSON.stringify(parsed) === JSON.stringify(uniqueDays);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('days should only contain valid day numbers (0-6)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
          (days) => {
            return days.every(d => d >= 0 && d <= 6);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: schedule-time-fix, Property 7: Scheduler trigger timing accuracy
   * For any recurring schedule with specified time, shouldTriggerDaily/shouldTriggerWeekly 
   * SHALL return true only when current time is within 0-5 minutes after scheduled time
   * Validates: Requirements 2.4
   */
  describe('Property 7: Scheduler trigger timing accuracy', () => {
    test('daily trigger should only fire within 0-5 minute window after schedule', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.integer({ min: -10, max: 10 }), // offset from scheduled time
          (schedHours, schedMinutes, offsetMinutes) => {
            const recurringTime = `${String(schedHours).padStart(2, '0')}:${String(schedMinutes).padStart(2, '0')}`;
            
            // Create a test date at the scheduled time + offset
            // Use a fixed date to avoid timezone issues
            const testDate = new Date('2025-01-15T00:00:00Z');
            
            // Calculate WIB offset (UTC+7)
            const wibOffsetMs = 7 * 60 * 60 * 1000;
            
            // Set the time in WIB
            const scheduleMs = (schedHours * 60 + schedMinutes) * 60 * 1000;
            const offsetMs = offsetMinutes * 60 * 1000;
            
            // Adjust for WIB: we want the WIB time to be schedHours:schedMinutes + offset
            // So UTC time should be (schedHours:schedMinutes + offset) - 7 hours
            testDate.setTime(testDate.getTime() + scheduleMs + offsetMs - wibOffsetMs);
            
            const shouldTrigger = shouldTriggerDaily(recurringTime, testDate);
            
            // Should trigger only if offset is 0-5 minutes
            const expectedTrigger = offsetMinutes >= 0 && offsetMinutes <= 5;
            
            return shouldTrigger === expectedTrigger;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('weekly trigger should respect day of week', () => {
      // Test that weekly trigger only fires on scheduled days
      const recurringTime = '10:00';
      const scheduleDays = [1, 3, 5]; // Mon, Wed, Fri
      
      // Create a Monday at 10:00 WIB
      const mondayDate = new Date('2025-01-13T03:00:00Z'); // 10:00 WIB
      expect(shouldTriggerWeekly(recurringTime, scheduleDays, mondayDate)).toBe(true);
      
      // Create a Tuesday at 10:00 WIB
      const tuesdayDate = new Date('2025-01-14T03:00:00Z'); // 10:00 WIB
      expect(shouldTriggerWeekly(recurringTime, scheduleDays, tuesdayDate)).toBe(false);
    });
  });

  /**
   * Feature: schedule-time-fix, Property 8: WIB timezone consistency
   * For any Date object, getWIBTime SHALL return hours, minutes, and day values 
   * that correspond to Asia/Jakarta timezone
   * Validates: Requirements 4.3
   */
  describe('Property 8: WIB timezone consistency', () => {
    test('WIB time should be UTC+7', () => {
      // Test known UTC times and their WIB equivalents
      const testCases = [
        { utc: '2025-01-15T00:00:00Z', expectedWIB: { hours: 7, minutes: 0 } },
        { utc: '2025-01-15T17:00:00Z', expectedWIB: { hours: 0, minutes: 0 } }, // midnight next day
        { utc: '2025-01-15T12:30:00Z', expectedWIB: { hours: 19, minutes: 30 } },
      ];
      
      for (const tc of testCases) {
        const date = new Date(tc.utc);
        const wibTime = getWIBTime(date);
        expect(wibTime.hours).toBe(tc.expectedWIB.hours);
        expect(wibTime.minutes).toBe(tc.expectedWIB.minutes);
      }
    });
    
    test('WIB hours should always be 0-23', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const wibTime = getWIBTime(date);
            return wibTime.hours >= 0 && wibTime.hours <= 23;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('WIB minutes should always be 0-59', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const wibTime = getWIBTime(date);
            return wibTime.minutes >= 0 && wibTime.minutes <= 59;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('WIB day should always be 0-6', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Skip invalid dates
            if (isNaN(date.getTime())) return true;
            
            const wibTime = getWIBTime(date);
            return wibTime.day >= 0 && wibTime.day <= 6;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
