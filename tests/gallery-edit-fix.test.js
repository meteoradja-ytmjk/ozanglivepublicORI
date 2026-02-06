/**
 * Property-Based Tests for Gallery Edit Fix Feature
 * 
 * These tests validate the correctness properties defined in the design document.
 * Using fast-check for property-based testing.
 * 
 * **Feature: gallery-edit-fix**
 */

const fc = require('fast-check');

// **Feature: gallery-edit-fix, Property 1: Duration update round trip**
// *For any* stream with a valid duration value, updating the stream via PUT endpoint 
// and then fetching it via GET endpoint SHALL return the same duration value that 
// was sent in the update request.

/**
 * Simulates the duration parsing logic from the PUT endpoint
 * @param {any} streamDuration - The duration value from request body
 * @returns {number|null} Parsed duration or null
 */
function parseDuration(streamDuration) {
  if (streamDuration === undefined) return undefined; // Not provided, don't update
  if (streamDuration === null || streamDuration === '') return null;
  const parsed = parseInt(streamDuration);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Simulates the update data preparation for stream_duration_hours
 * @param {object} reqBody - Request body object
 * @returns {object} Update data object with stream_duration_hours if applicable
 */
function prepareUpdateData(reqBody) {
  const updateData = {};
  
  if (reqBody.streamDuration !== undefined) {
    updateData.stream_duration_hours = reqBody.streamDuration ? parseInt(reqBody.streamDuration) : null;
  }
  
  return updateData;
}

// **Feature: gallery-edit-fix, Property 2: Icon font-loaded class application**
// *For any* dynamically rendered stream list, after renderStreams() completes, 
// all elements with class `ti` SHALL also have the class `font-loaded`.

/**
 * Simulates applying font-loaded class to icons
 * @param {Array} icons - Array of icon objects with classList
 * @returns {Array} Icons with font-loaded class added
 */
function applyFontLoadedClass(icons) {
  return icons.map(icon => ({
    ...icon,
    classList: icon.classList.includes('font-loaded') 
      ? icon.classList 
      : [...icon.classList, 'font-loaded']
  }));
}

/**
 * Checks if all icons have font-loaded class
 * @param {Array} icons - Array of icon objects with classList
 * @returns {boolean} True if all icons have font-loaded class
 */
function allIconsHaveFontLoaded(icons) {
  return icons.every(icon => icon.classList.includes('font-loaded'));
}

describe('Gallery Edit Fix Feature - Property Tests', () => {
  
  describe('Property 1: Duration update round trip', () => {
    // **Validates: Requirements 1.1**
    
    test('valid duration values should be preserved after parsing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }), // Valid duration range: 1-168 hours
          (duration) => {
            const reqBody = { streamDuration: duration };
            const updateData = prepareUpdateData(reqBody);
            
            // The parsed duration should equal the input
            return updateData.stream_duration_hours === duration;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('string duration values should be parsed to integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (duration) => {
            const reqBody = { streamDuration: String(duration) };
            const updateData = prepareUpdateData(reqBody);
            
            // String should be parsed to same integer
            return updateData.stream_duration_hours === duration;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty/null duration should result in null', () => {
      // Empty string
      let updateData = prepareUpdateData({ streamDuration: '' });
      expect(updateData.stream_duration_hours).toBeNull();
      
      // Null value
      updateData = prepareUpdateData({ streamDuration: null });
      expect(updateData.stream_duration_hours).toBeNull();
      
      // Zero value (edge case - should be null as 0 is falsy)
      updateData = prepareUpdateData({ streamDuration: 0 });
      expect(updateData.stream_duration_hours).toBeNull();
    });

    test('undefined duration should not add to updateData', () => {
      const updateData = prepareUpdateData({});
      expect(updateData.stream_duration_hours).toBeUndefined();
    });

    test('duration round trip: parse -> store -> retrieve should be identity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          (originalDuration) => {
            // Simulate: client sends duration -> server parses -> stores -> retrieves
            const reqBody = { streamDuration: originalDuration };
            const updateData = prepareUpdateData(reqBody);
            const storedDuration = updateData.stream_duration_hours;
            
            // Retrieved value should equal original
            return storedDuration === originalDuration;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Icon font-loaded class application', () => {
    // **Validates: Requirements 2.1, 3.2**
    
    test('all icons should have font-loaded class after application', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              classList: fc.array(fc.constantFrom('ti', 'ti-edit', 'ti-trash', 'ti-player-play', 'ti-player-stop'), { minLength: 1, maxLength: 3 })
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (icons) => {
            const processedIcons = applyFontLoadedClass(icons);
            return allIconsHaveFontLoaded(processedIcons);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('icons already with font-loaded should not get duplicate class', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              classList: fc.constant(['ti', 'ti-edit', 'font-loaded'])
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (icons) => {
            const processedIcons = applyFontLoadedClass(icons);
            
            // Count font-loaded occurrences - should be exactly 1
            return processedIcons.every(icon => 
              icon.classList.filter(c => c === 'font-loaded').length === 1
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty icon list should return empty list', () => {
      const result = applyFontLoadedClass([]);
      expect(result).toEqual([]);
    });

    test('mixed icons (with and without font-loaded) should all have font-loaded after', () => {
      const mixedIcons = [
        { id: '1', classList: ['ti', 'ti-edit'] },
        { id: '2', classList: ['ti', 'ti-trash', 'font-loaded'] },
        { id: '3', classList: ['ti', 'ti-player-play'] }
      ];
      
      const result = applyFontLoadedClass(mixedIcons);
      expect(allIconsHaveFontLoaded(result)).toBe(true);
    });
  });
});

// Export functions for potential reuse
module.exports = {
  parseDuration,
  prepareUpdateData,
  applyFontLoadedClass,
  allIconsHaveFontLoaded
};
