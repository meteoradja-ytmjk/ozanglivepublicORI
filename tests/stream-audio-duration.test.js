/**
 * Property-Based Tests for Stream Audio & Duration Feature
 * 
 * These tests validate the correctness properties defined in the design document.
 * Using fast-check for property-based testing.
 */

const fc = require('fast-check');

// **Feature: stream-audio-duration, Property 1: Audio search filter correctness**
// *For any* search query and list of audios, all returned audios should have names 
// that contain the search query (case-insensitive)

/**
 * Filter audios by search query
 * @param {Array} audios - Array of audio objects with title/name properties
 * @param {string} query - Search query string
 * @returns {Array} Filtered audios
 */
function filterAudios(audios, query) {
  if (!query || query.trim() === '') return audios;
  const lowerQuery = query.toLowerCase();
  return audios.filter(audio => 
    (audio.title && audio.title.toLowerCase().includes(lowerQuery)) ||
    (audio.name && audio.name.toLowerCase().includes(lowerQuery))
  );
}

// **Feature: stream-audio-duration, Property 2: End time calculation correctness**
// *For any* valid start time and duration in hours, the calculated end time should 
// equal start time plus (duration × 60 minutes)

/**
 * Calculate end time based on start time and duration in hours
 * @param {Date} startTime - Start time as Date object
 * @param {number} durationHours - Duration in hours
 * @returns {Date} Calculated end time
 */
function calculateEndTime(startTime, durationHours) {
  if (!startTime || !durationHours || durationHours <= 0) return null;
  return new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
}

describe('Stream Audio & Duration Feature - Property Tests', () => {
  
  describe('Property 1: Audio search filter correctness', () => {
    // **Validates: Requirements 1.5**
    
    test('all filtered audios should contain the search query in their name (case-insensitive)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 100 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              duration: fc.string(),
              format: fc.constantFrom('mp3', 'wav', 'ogg', 'aac')
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.string({ minLength: 1, maxLength: 20 }),
          (audios, query) => {
            const filtered = filterAudios(audios, query);
            const lowerQuery = query.toLowerCase();
            
            // All filtered results should contain the query
            return filtered.every(audio => 
              (audio.title && audio.title.toLowerCase().includes(lowerQuery)) ||
              (audio.name && audio.name.toLowerCase().includes(lowerQuery))
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty query should return all audios', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 100 }),
              name: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (audios) => {
            const filtered = filterAudios(audios, '');
            return filtered.length === audios.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('filtered results should be subset of original audios', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 100 }),
              name: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.string({ minLength: 0, maxLength: 20 }),
          (audios, query) => {
            const filtered = filterAudios(audios, query);
            return filtered.length <= audios.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: End time calculation correctness', () => {
    // **Validates: Requirements 2.5**
    
    test('end time should equal start time plus duration in milliseconds', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week
          (startTime, durationHours) => {
            // Skip invalid dates
            if (isNaN(startTime.getTime())) return true;
            
            const endTime = calculateEndTime(startTime, durationHours);
            const expectedEnd = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
            return endTime.getTime() === expectedEnd.getTime();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('end time should always be after start time for positive duration', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }),
          (startTime, durationHours) => {
            // Skip invalid dates
            if (isNaN(startTime.getTime())) return true;
            
            const endTime = calculateEndTime(startTime, durationHours);
            return endTime > startTime;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('duration difference should match input hours', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }),
          (startTime, durationHours) => {
            // Skip invalid dates
            if (isNaN(startTime.getTime())) return true;
            
            const endTime = calculateEndTime(startTime, durationHours);
            const diffMs = endTime.getTime() - startTime.getTime();
            const diffHours = diffMs / (60 * 60 * 1000);
            return Math.abs(diffHours - durationHours) < 0.0001; // floating point tolerance
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/invalid inputs should return null', () => {
      expect(calculateEndTime(null, 5)).toBeNull();
      expect(calculateEndTime(new Date(), 0)).toBeNull();
      expect(calculateEndTime(new Date(), -1)).toBeNull();
      expect(calculateEndTime(new Date(), null)).toBeNull();
    });
  });
});

// Export functions for use in application
module.exports = {
  filterAudios,
  calculateEndTime
};
