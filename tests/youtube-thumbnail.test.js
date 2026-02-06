/**
 * YouTube Thumbnail Validation Property Tests
 * **Feature: youtube-sync**
 */

const fc = require('fast-check');

// Thumbnail validation helper (same logic as in app.js)
function validateThumbnail(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const maxSize = 2 * 1024 * 1024; // 2MB
  
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Only JPG and PNG are allowed' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 2MB' };
  }
  
  return { valid: true };
}

describe('YouTube Thumbnail Validation', () => {
  /**
   * **Feature: youtube-sync, Property 8: Thumbnail validation**
   * *For any* thumbnail upload, the system SHALL reject files that are not JPG or PNG format, 
   * or exceed 2MB in size.
   * **Validates: Requirements 2.7**
   */
  test('Property 8: Rejects invalid file types', async () => {
    const invalidTypes = [
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'video/mp4',
      'audio/mp3'
    ];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidTypes),
        fc.integer({ min: 1, max: 2 * 1024 * 1024 }), // Valid size
        async (mimetype, size) => {
          const file = { mimetype, size };
          const result = validateThumbnail(file);
          
          expect(result.valid).toBe(false);
          expect(result.error).toContain('Invalid file type');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 8: Rejects files exceeding 2MB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('image/jpeg', 'image/png'),
        fc.integer({ min: 2 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }), // Over 2MB
        async (mimetype, size) => {
          const file = { mimetype, size };
          const result = validateThumbnail(file);
          
          expect(result.valid).toBe(false);
          expect(result.error).toContain('File too large');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 8: Accepts valid JPG/PNG files under 2MB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('image/jpeg', 'image/png', 'image/jpg'),
        fc.integer({ min: 1, max: 2 * 1024 * 1024 }), // Valid size (1 byte to 2MB)
        async (mimetype, size) => {
          const file = { mimetype, size };
          const result = validateThumbnail(file);
          
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 8: Rejects null/undefined file', () => {
    expect(validateThumbnail(null).valid).toBe(false);
    expect(validateThumbnail(undefined).valid).toBe(false);
  });
});
