/**
 * Property-Based Tests for Duration Format Update Feature
 * 
 * These tests validate the correctness properties defined in the design document.
 * Using fast-check for property-based testing.
 * 
 * **Feature: duration-format-update**
 */

const fc = require('fast-check');

// ============================================
// UTILITY FUNCTIONS (to be implemented in frontend)
// ============================================

/**
 * Calculate total minutes from hours and minutes
 * @param {number|string} hours - Hours value
 * @param {number|string} minutes - Minutes value
 * @returns {number} Total minutes
 */
function calculateTotalMinutes(hours, minutes) {
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  return (h * 60) + m;
}

/**
 * Format total minutes to display string
 * @param {number} totalMinutes - Total minutes
 * @returns {string} Formatted duration string
 */
function formatDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '-';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours} jam ${minutes} menit`;
  } else if (hours > 0) {
    return `${hours} jam`;
  } else {
    return `${minutes} menit`;
  }
}

/**
 * Parse total minutes to hours and minutes fields
 * @param {number} totalMinutes - Total minutes
 * @returns {Object} Object with hours and minutes properties
 */
function parseDurationToFields(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) {
    return { hours: 0, minutes: 0 };
  }
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

/**
 * Validate hours input (0-168)
 * @param {number} hours - Hours value
 * @returns {boolean} True if valid
 */
function isValidHours(hours) {
  const h = parseInt(hours, 10);
  return !isNaN(h) && h >= 0 && h <= 168;
}

/**
 * Validate minutes input (0-59)
 * @param {number} minutes - Minutes value
 * @returns {boolean} True if valid
 */
function isValidMinutes(minutes) {
  const m = parseInt(minutes, 10);
  return !isNaN(m) && m >= 0 && m <= 59;
}

/**
 * Convert hours to minutes (for backward compatibility)
 * @param {number} hours - Hours value
 * @returns {number} Minutes value
 */
function convertHoursToMinutes(hours) {
  const h = parseInt(hours, 10) || 0;
  return h * 60;
}

// ============================================
// PROPERTY-BASED TESTS
// ============================================

describe('Duration Format Update Feature - Property Tests', () => {
  
  describe('Property 1: Hours validation range', () => {
    /**
     * **Feature: duration-format-update, Property 1: Hours validation range**
     * **Validates: Requirements 1.2**
     * 
     * *For any* input value for hours field, the system SHALL accept only 
     * integer values from 0 to 168 inclusive.
     */
    
    test('should accept valid hours values (0-168)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 168 }),
          (hours) => {
            return isValidHours(hours) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject hours values below 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          (hours) => {
            return isValidHours(hours) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject hours values above 168', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 169, max: 1000 }),
          (hours) => {
            return isValidHours(hours) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('boundary test: 0 hours should be valid', () => {
      expect(isValidHours(0)).toBe(true);
    });

    test('boundary test: 168 hours should be valid', () => {
      expect(isValidHours(168)).toBe(true);
    });
  });

  describe('Property 2: Minutes validation range', () => {
    /**
     * **Feature: duration-format-update, Property 2: Minutes validation range**
     * **Validates: Requirements 1.3**
     * 
     * *For any* input value for minutes field, the system SHALL accept only 
     * integer values from 0 to 59 inclusive.
     */
    
    test('should accept valid minutes values (0-59)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 59 }),
          (minutes) => {
            return isValidMinutes(minutes) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject minutes values below 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          (minutes) => {
            return isValidMinutes(minutes) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject minutes values above 59', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 1000 }),
          (minutes) => {
            return isValidMinutes(minutes) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('boundary test: 0 minutes should be valid', () => {
      expect(isValidMinutes(0)).toBe(true);
    });

    test('boundary test: 59 minutes should be valid', () => {
      expect(isValidMinutes(59)).toBe(true);
    });
  });

  describe('Property 3: Total minutes calculation correctness', () => {
    /**
     * **Feature: duration-format-update, Property 3: Total minutes calculation correctness**
     * **Validates: Requirements 1.4**
     * 
     * *For any* valid hours (0-168) and minutes (0-59) combination, 
     * the calculated total minutes SHALL equal (hours × 60) + minutes.
     */
    
    test('total minutes should equal (hours × 60) + minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 168 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const totalMinutes = calculateTotalMinutes(hours, minutes);
            const expected = (hours * 60) + minutes;
            return totalMinutes === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle string inputs correctly', () => {
      expect(calculateTotalMinutes('2', '30')).toBe(150);
      expect(calculateTotalMinutes('0', '45')).toBe(45);
      expect(calculateTotalMinutes('1', '0')).toBe(60);
    });

    test('should handle empty/invalid inputs as 0', () => {
      expect(calculateTotalMinutes('', '')).toBe(0);
      expect(calculateTotalMinutes(null, null)).toBe(0);
      expect(calculateTotalMinutes(undefined, undefined)).toBe(0);
      expect(calculateTotalMinutes('abc', 'xyz')).toBe(0);
    });
  });

  describe('Property 4: Duration format correctness', () => {
    /**
     * **Feature: duration-format-update, Property 4: Duration format correctness**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * *For any* total minutes value greater than 0, the formatted string SHALL 
     * correctly represent the duration:
     * - If hours > 0 and minutes > 0: "X jam Y menit"
     * - If hours > 0 and minutes = 0: "X jam"
     * - If hours = 0 and minutes > 0: "Y menit"
     */
    
    test('should format as "X jam Y menit" when both hours and minutes > 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          fc.integer({ min: 1, max: 59 }),
          (hours, minutes) => {
            const totalMinutes = (hours * 60) + minutes;
            const formatted = formatDuration(totalMinutes);
            return formatted === `${hours} jam ${minutes} menit`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should format as "X jam" when only hours > 0 (minutes = 0)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (hours) => {
            const totalMinutes = hours * 60;
            const formatted = formatDuration(totalMinutes);
            return formatted === `${hours} jam`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should format as "Y menit" when only minutes > 0 (hours = 0)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 59 }),
          (minutes) => {
            const formatted = formatDuration(minutes);
            return formatted === `${minutes} menit`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return "-" for null, 0, or negative values', () => {
      expect(formatDuration(null)).toBe('-');
      expect(formatDuration(0)).toBe('-');
      expect(formatDuration(-10)).toBe('-');
      expect(formatDuration(undefined)).toBe('-');
    });
  });

  describe('Property 5: Duration round-trip consistency', () => {
    /**
     * **Feature: duration-format-update, Property 5: Duration round-trip consistency**
     * **Validates: Requirements 2.4**
     * 
     * *For any* valid total minutes value, parsing to hours/minutes fields and 
     * then calculating back to total minutes SHALL produce the original value.
     */
    
    test('round-trip: totalMinutes -> parse -> calculate should return original', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10080 }), // 1 minute to 1 week
          (totalMinutes) => {
            const { hours, minutes } = parseDurationToFields(totalMinutes);
            const recalculated = calculateTotalMinutes(hours, minutes);
            return recalculated === totalMinutes;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('round-trip: hours/minutes -> calculate -> parse should return original', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 168 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const totalMinutes = calculateTotalMinutes(hours, minutes);
            const parsed = parseDurationToFields(totalMinutes);
            return parsed.hours === hours && parsed.minutes === minutes;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle edge case: 0 total minutes', () => {
      const parsed = parseDurationToFields(0);
      expect(parsed.hours).toBe(0);
      expect(parsed.minutes).toBe(0);
    });
  });

  describe('Property 6: Backward compatibility conversion', () => {
    /**
     * **Feature: duration-format-update, Property 6: Backward compatibility conversion**
     * **Validates: Requirements 3.1**
     * 
     * *For any* existing stream_duration_hours value, the converted 
     * stream_duration_minutes SHALL equal stream_duration_hours × 60.
     */
    
    test('hours to minutes conversion should equal hours × 60', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (hours) => {
            const minutes = convertHoursToMinutes(hours);
            return minutes === hours * 60;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle null/undefined hours as 0', () => {
      expect(convertHoursToMinutes(null)).toBe(0);
      expect(convertHoursToMinutes(undefined)).toBe(0);
    });

    test('specific conversion examples', () => {
      expect(convertHoursToMinutes(1)).toBe(60);
      expect(convertHoursToMinutes(2)).toBe(120);
      expect(convertHoursToMinutes(24)).toBe(1440);
      expect(convertHoursToMinutes(168)).toBe(10080);
    });
  });
});

// Export utility functions for use in application
module.exports = {
  calculateTotalMinutes,
  formatDuration,
  parseDurationToFields,
  isValidHours,
  isValidMinutes,
  convertHoursToMinutes
};
