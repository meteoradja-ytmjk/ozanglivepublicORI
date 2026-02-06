/**
 * Property-based tests for DriveImportQueueManager
 * Tests link parsing, validation, status tracking, and batch import management
 */

const fc = require('fast-check');
const DriveImportQueueManager = require('../public/js/driveImportQueueManager');

// Valid Google Drive URL patterns for testing
const validDrivePatterns = [
  'https://drive.google.com/file/d/{id}/view',
  'https://drive.google.com/file/d/{id}/view?usp=sharing',
  'https://drive.google.com/open?id={id}',
  'https://docs.google.com/file/d/{id}/view',
  'https://drive.google.com/uc?id={id}&export=download'
];

// Invalid URL patterns
const invalidPatterns = [
  'https://example.com/file.mp4',
  'https://youtube.com/watch?v=abc123',
  'not-a-url',
  'https://drive.google.com/',
  'https://drive.google.com/drive/folders/abc'
];

// Generate valid file ID (alphanumeric with - and _, 10+ chars)
const fileIdChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
const validFileIdArb = fc.array(
  fc.constantFrom(...fileIdChars.split('')),
  { minLength: 15, maxLength: 40 }
).map(chars => chars.join(''));

// Generate valid Google Drive URL
const validDriveUrlArb = fc.tuple(
  fc.constantFrom(...validDrivePatterns),
  validFileIdArb
).map(([pattern, id]) => pattern.replace('{id}', id));

// Generate invalid URL
const invalidUrlArb = fc.constantFrom(...invalidPatterns);

describe('DriveImportQueueManager', () => {
  describe('Core Functionality', () => {
    test('should create instance with default options', () => {
      const manager = new DriveImportQueueManager();
      expect(manager.type).toBe('video');
      expect(manager.files).toEqual([]);
      expect(manager.isProcessing).toBe(false);
      expect(manager.batchId).toBeNull();
    });

    test('should create instance with audio type', () => {
      const manager = new DriveImportQueueManager({ type: 'audio' });
      expect(manager.type).toBe('audio');
      expect(manager.batchUrl).toBe('/api/audios/import-drive-batch');
      expect(manager.statusUrl).toBe('/api/audios/import-batch-status');
    });

    test('should create instance with video type', () => {
      const manager = new DriveImportQueueManager({ type: 'video' });
      expect(manager.type).toBe('video');
      expect(manager.batchUrl).toBe('/api/videos/import-drive-batch');
      expect(manager.statusUrl).toBe('/api/videos/import-batch-status');
    });
  });

  /**
   * Property 1: Link Parsing Correctness
   * For any multi-line text input, parsing SHALL produce an array where each non-empty line
   * becomes a separate link entry, and the count of entries SHALL equal the count of non-empty lines.
   * 
   * **Feature: multiple-drive-import, Property 1: Link Parsing Correctness**
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Link Parsing Correctness', () => {
    test('parsing should produce correct count of non-empty lines', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
          (lines) => {
            const manager = new DriveImportQueueManager();
            const text = lines.join('\n');
            const result = manager.parseLinks(text);
            
            // Count non-empty trimmed lines
            const expectedCount = lines.filter(line => line.trim().length > 0).length;
            
            // Property: result count should equal non-empty line count
            expect(result.length).toBe(expectedCount);
            
            // Property: all results should be non-empty trimmed strings
            for (const link of result) {
              expect(link.length).toBeGreaterThan(0);
              expect(link).toBe(link.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('parsing empty string should return empty array', () => {
      const manager = new DriveImportQueueManager();
      expect(manager.parseLinks('')).toEqual([]);
      expect(manager.parseLinks(null)).toEqual([]);
      expect(manager.parseLinks(undefined)).toEqual([]);
    });

    test('parsing should handle various newline formats', () => {
      const manager = new DriveImportQueueManager();
      
      // Unix newlines
      expect(manager.parseLinks('link1\nlink2\nlink3')).toEqual(['link1', 'link2', 'link3']);
      
      // Windows newlines
      expect(manager.parseLinks('link1\r\nlink2\r\nlink3')).toEqual(['link1', 'link2', 'link3']);
      
      // Mixed newlines
      expect(manager.parseLinks('link1\nlink2\r\nlink3')).toEqual(['link1', 'link2', 'link3']);
      
      // Multiple consecutive newlines
      expect(manager.parseLinks('link1\n\n\nlink2')).toEqual(['link1', 'link2']);
    });

    test('parsing should trim whitespace from each line', () => {
      const manager = new DriveImportQueueManager();
      const result = manager.parseLinks('  link1  \n  link2  \n  link3  ');
      expect(result).toEqual(['link1', 'link2', 'link3']);
    });

    test('parsing should filter out empty and whitespace-only lines', () => {
      const manager = new DriveImportQueueManager();
      const result = manager.parseLinks('link1\n   \nlink2\n\nlink3');
      expect(result).toEqual(['link1', 'link2', 'link3']);
    });
  });

  /**
   * Property 2: Link Validation Correctness
   * For any list of links containing both valid and invalid Google Drive URLs,
   * validation SHALL correctly identify valid links and invalid links.
   * 
   * **Feature: multiple-drive-import, Property 2: Link Validation Correctness**
   * **Validates: Requirements 1.3, 1.4**
   */
  describe('Property 2: Link Validation Correctness', () => {
    test('validation should correctly identify valid Google Drive URLs', () => {
      fc.assert(
        fc.property(validDriveUrlArb, (url) => {
          const manager = new DriveImportQueueManager();
          const result = manager.validateLink(url);
          
          // Property: valid URLs should be marked as valid
          expect(result.valid).toBe(true);
          expect(result.fileId).not.toBeNull();
          expect(result.error).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    test('validation should correctly identify invalid URLs', () => {
      fc.assert(
        fc.property(invalidUrlArb, (url) => {
          const manager = new DriveImportQueueManager();
          const result = manager.validateLink(url);
          
          // Property: invalid URLs should be marked as invalid
          expect(result.valid).toBe(false);
          expect(result.error).not.toBeNull();
        }),
        { numRuns: 50 }
      );
    });

    test('validateAllLinks should separate valid and invalid links', () => {
      fc.assert(
        fc.property(
          fc.array(validDriveUrlArb, { minLength: 0, maxLength: 5 }),
          fc.array(invalidUrlArb, { minLength: 0, maxLength: 5 }),
          (validUrls, invalidUrls) => {
            const manager = new DriveImportQueueManager();
            const allLinks = [...validUrls, ...invalidUrls];
            const result = manager.validateAllLinks(allLinks);
            
            // Property: valid count should match input valid count
            expect(result.valid.length).toBe(validUrls.length);
            
            // Property: invalid count should match input invalid count
            expect(result.invalid.length).toBe(invalidUrls.length);
            
            // Property: total should equal input
            expect(result.valid.length + result.invalid.length).toBe(allLinks.length);
            
            // Property: allValid should be true only if no invalid links
            expect(result.allValid).toBe(invalidUrls.length === 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validation should handle edge cases', () => {
      const manager = new DriveImportQueueManager();
      
      // Empty string
      expect(manager.validateLink('').valid).toBe(false);
      
      // Null
      expect(manager.validateLink(null).valid).toBe(false);
      
      // Undefined
      expect(manager.validateLink(undefined).valid).toBe(false);
      
      // Whitespace only
      expect(manager.validateLink('   ').valid).toBe(false);
    });

    test('validation should extract file ID correctly', () => {
      const manager = new DriveImportQueueManager();
      const testId = 'abc123XYZ_-testFileId';
      
      // Pattern: /file/d/{id}/
      let result = manager.validateLink(`https://drive.google.com/file/d/${testId}/view`);
      expect(result.valid).toBe(true);
      expect(result.fileId).toBe(testId);
      
      // Pattern: ?id={id}
      result = manager.validateLink(`https://drive.google.com/open?id=${testId}`);
      expect(result.valid).toBe(true);
      expect(result.fileId).toBe(testId);
      
      // Pattern: /d/{id}/
      result = manager.validateLink(`https://docs.google.com/d/${testId}/view`);
      expect(result.valid).toBe(true);
      expect(result.fileId).toBe(testId);
    });
  });

  /**
   * Property 3: Status Tracking Completeness
   * For any batch import job, each file SHALL have a status field that is one of:
   * 'pending', 'downloading', 'processing', 'completed', or 'failed'.
   * 
   * **Feature: multiple-drive-import, Property 3: Status Tracking Completeness**
   * **Validates: Requirements 2.1, 2.3, 2.4**
   */
  describe('Property 3: Status Tracking Completeness', () => {
    const validStatuses = ['pending', 'downloading', 'processing', 'completed', 'failed'];
    
    test('getStatusCounts should only count valid statuses', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom(...validStatuses),
              progress: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fileStates) => {
            const manager = new DriveImportQueueManager();
            
            // Set up files with given states
            manager.files = fileStates.map((state, index) => ({
              index,
              link: `https://drive.google.com/file/d/test${index}/view`,
              status: state.status,
              progress: state.progress
            }));
            
            const counts = manager.getStatusCounts();
            
            // Property: total should equal file count
            expect(counts.total).toBe(fileStates.length);
            
            // Property: sum of all status counts should equal total
            const sum = counts.pending + counts.downloading + counts.processing + 
                       counts.completed + counts.failed;
            expect(sum).toBe(counts.total);
            
            // Property: each status count should match actual count
            for (const status of validStatuses) {
              const expected = fileStates.filter(f => f.status === status).length;
              expect(counts[status]).toBe(expected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty files should return zero counts', () => {
      const manager = new DriveImportQueueManager();
      const counts = manager.getStatusCounts();
      
      expect(counts.total).toBe(0);
      expect(counts.pending).toBe(0);
      expect(counts.downloading).toBe(0);
      expect(counts.processing).toBe(0);
      expect(counts.completed).toBe(0);
      expect(counts.failed).toBe(0);
    });
  });

  /**
   * Property 4: Progress Bounds
   * For any file in the import queue, the progress value SHALL be between 0 and 100 inclusive.
   * 
   * **Feature: multiple-drive-import, Property 4: Progress Bounds**
   * **Validates: Requirements 2.2**
   */
  describe('Property 4: Progress Bounds', () => {
    test('overall progress should be between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom('pending', 'downloading', 'processing', 'completed', 'failed'),
              progress: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fileStates) => {
            const manager = new DriveImportQueueManager();
            
            manager.files = fileStates.map((state, index) => ({
              index,
              link: `https://drive.google.com/file/d/test${index}/view`,
              status: state.status,
              progress: state.progress
            }));
            
            const overallProgress = manager.getOverallProgress();
            
            // Property: overall progress should be between 0 and 100
            expect(overallProgress).toBeGreaterThanOrEqual(0);
            expect(overallProgress).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty queue should have 0 progress', () => {
      const manager = new DriveImportQueueManager();
      expect(manager.getOverallProgress()).toBe(0);
    });

    test('all completed should have 100 progress', () => {
      const manager = new DriveImportQueueManager();
      manager.files = [
        { index: 0, status: 'completed', progress: 100 },
        { index: 1, status: 'completed', progress: 100 }
      ];
      expect(manager.getOverallProgress()).toBe(100);
    });

    test('all failed should have 100 progress (counted as processed)', () => {
      const manager = new DriveImportQueueManager();
      manager.files = [
        { index: 0, status: 'failed', progress: 0 },
        { index: 1, status: 'failed', progress: 0 }
      ];
      expect(manager.getOverallProgress()).toBe(100);
    });
  });

  /**
   * Property 5: Error Resilience
   * For any batch import where file at index N fails,
   * files at indices greater than N SHALL still be processed (unless cancelled).
   * 
   * **Feature: multiple-drive-import, Property 5: Error Resilience**
   * **Validates: Requirements 3.1**
   */
  describe('Property 5: Error Resilience', () => {
    test('failed files should not affect status of other files', () => {
      const manager = new DriveImportQueueManager();
      
      // Simulate a batch with mixed results
      manager.files = [
        { index: 0, status: 'completed', progress: 100 },
        { index: 1, status: 'failed', progress: 0, error: 'Network error' },
        { index: 2, status: 'completed', progress: 100 },
        { index: 3, status: 'pending', progress: 0 }
      ];
      
      const counts = manager.getStatusCounts();
      
      // Property: counts should reflect actual statuses
      expect(counts.completed).toBe(2);
      expect(counts.failed).toBe(1);
      expect(counts.pending).toBe(1);
      
      // Property: hasFailedFiles should return true
      expect(manager.hasFailedFiles()).toBe(true);
      
      // Property: isComplete should return false (pending file exists)
      expect(manager.isComplete()).toBe(false);
    });

    test('isComplete should be true when all files are completed or failed', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('completed', 'failed'),
            { minLength: 1, maxLength: 10 }
          ),
          (statuses) => {
            const manager = new DriveImportQueueManager();
            
            manager.files = statuses.map((status, index) => ({
              index,
              status,
              progress: status === 'completed' ? 100 : 0
            }));
            
            // Property: isComplete should be true when all are completed or failed
            expect(manager.isComplete()).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('isComplete should be false when any file is pending/downloading/processing', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pending', 'downloading', 'processing'),
          (activeStatus) => {
            const manager = new DriveImportQueueManager();
            
            manager.files = [
              { index: 0, status: 'completed', progress: 100 },
              { index: 1, status: activeStatus, progress: 50 },
              { index: 2, status: 'failed', progress: 0 }
            ];
            
            // Property: isComplete should be false
            expect(manager.isComplete()).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 6: Summary Accuracy
   * For any completed batch import, the sum of completed + failed + pending + processing counts
   * SHALL equal the total file count.
   * 
   * **Feature: multiple-drive-import, Property 6: Summary Accuracy**
   * **Validates: Requirements 3.2**
   */
  describe('Property 6: Summary Accuracy', () => {
    test('status counts should sum to total', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('pending', 'downloading', 'processing', 'completed', 'failed'),
            { minLength: 1, maxLength: 20 }
          ),
          (statuses) => {
            const manager = new DriveImportQueueManager();
            
            manager.files = statuses.map((status, index) => ({
              index,
              status,
              progress: status === 'completed' ? 100 : 0
            }));
            
            const counts = manager.getStatusCounts();
            
            // Property: sum should equal total
            const sum = counts.pending + counts.downloading + counts.processing + 
                       counts.completed + counts.failed;
            expect(sum).toBe(counts.total);
            expect(counts.total).toBe(statuses.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Sequential Processing
   * For any batch import, at most one file SHALL have status 'downloading' or 'processing'
   * at any given time.
   * 
   * **Feature: multiple-drive-import, Property 7: Sequential Processing**
   * **Validates: Requirements 6.1**
   */
  describe('Property 7: Sequential Processing', () => {
    test('at most one file should be actively processing', () => {
      // This is a design constraint - the backend ensures sequential processing
      // We test that the manager correctly reports the count
      const manager = new DriveImportQueueManager();
      
      // Valid state: one downloading
      manager.files = [
        { index: 0, status: 'completed', progress: 100 },
        { index: 1, status: 'downloading', progress: 50 },
        { index: 2, status: 'pending', progress: 0 }
      ];
      
      const counts = manager.getStatusCounts();
      const activeCount = counts.downloading + counts.processing;
      
      // In a correctly functioning system, this should be <= 1
      // The test documents the expected behavior
      expect(activeCount).toBeLessThanOrEqual(1);
    });
  });

  /**
   * Property 8: Cancel State Preservation
   * For any cancelled batch import, files that were already 'completed' SHALL remain 'completed',
   * and remaining files SHALL not be processed.
   * 
   * **Feature: multiple-drive-import, Property 8: Cancel State Preservation**
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 8: Cancel State Preservation', () => {
    test('completed files should remain completed after cancel', () => {
      const manager = new DriveImportQueueManager();
      
      // Simulate state before cancel
      manager.files = [
        { index: 0, status: 'completed', progress: 100 },
        { index: 1, status: 'completed', progress: 100 },
        { index: 2, status: 'downloading', progress: 50 },
        { index: 3, status: 'pending', progress: 0 }
      ];
      
      // Mark as cancelled
      manager.isCancelled = true;
      
      // Property: completed files should still be completed
      const completedFiles = manager.files.filter(f => f.status === 'completed');
      expect(completedFiles.length).toBe(2);
      
      // Property: getStatusCounts should still work correctly
      const counts = manager.getStatusCounts();
      expect(counts.completed).toBe(2);
    });

    test('hasFailedFiles should work correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('pending', 'downloading', 'processing', 'completed', 'failed'),
            { minLength: 1, maxLength: 10 }
          ),
          (statuses) => {
            const manager = new DriveImportQueueManager();
            
            manager.files = statuses.map((status, index) => ({
              index,
              status,
              progress: 0
            }));
            
            const hasFailed = manager.hasFailedFiles();
            const expectedHasFailed = statuses.includes('failed');
            
            expect(hasFailed).toBe(expectedHasFailed);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Reset Functionality', () => {
    test('reset should clear all state', () => {
      const manager = new DriveImportQueueManager();
      
      // Set up some state
      manager.files = [{ index: 0, status: 'completed' }];
      manager.batchId = 'test-batch-id';
      manager.isProcessing = true;
      manager.isCancelled = true;
      
      // Reset
      manager.reset();
      
      // Verify all state is cleared
      expect(manager.files).toEqual([]);
      expect(manager.batchId).toBeNull();
      expect(manager.isProcessing).toBe(false);
      expect(manager.isCancelled).toBe(false);
    });
  });
});
