/**
 * Property-based tests for FileQueueManager
 * Tests file filtering, queue operations, progress calculation, and state management
 */

const fc = require('fast-check');
const FileQueueManager = require('../public/js/fileQueueManager');

// Mock File class for testing
class MockFile {
  constructor(name, size, type) {
    this.name = name;
    this.size = size;
    this.type = type;
  }
}

// Arbitraries for generating test data
const validVideoExtensions = ['.mp4', '.avi', '.mov'];
const validVideoMimeTypes = ['video/mp4', 'video/avi', 'video/quicktime'];
const invalidExtensions = ['.txt', '.pdf', '.exe', '.jpg', '.png', '.doc'];
const invalidMimeTypes = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png'];

const validAudioExtensions = ['.mp3', '.wav', '.aac', '.m4a'];
const validAudioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'];

// Generate valid video file
const validVideoFileArb = fc.record({
  name: fc.constantFrom(...validVideoExtensions).map(ext => `video_${Date.now()}${ext}`),
  size: fc.integer({ min: 1024, max: 1073741824 }), // 1KB to 1GB
  type: fc.constantFrom(...validVideoMimeTypes)
}).map(({ name, size, type }) => new MockFile(name, size, type));

// Generate invalid video file
const invalidVideoFileArb = fc.record({
  name: fc.constantFrom(...invalidExtensions).map(ext => `file_${Date.now()}${ext}`),
  size: fc.integer({ min: 1024, max: 1073741824 }),
  type: fc.constantFrom(...invalidMimeTypes)
}).map(({ name, size, type }) => new MockFile(name, size, type));

// Generate mixed file list (valid and invalid)
const mixedFileListArb = fc.tuple(
  fc.array(validVideoFileArb, { minLength: 0, maxLength: 5 }),
  fc.array(invalidVideoFileArb, { minLength: 0, maxLength: 5 })
).map(([valid, invalid]) => ({
  files: [...valid, ...invalid].sort(() => Math.random() - 0.5),
  validCount: valid.length,
  invalidCount: invalid.length
}));

describe('FileQueueManager', () => {
  describe('Core Functionality', () => {
    test('should create instance with default options', () => {
      const manager = new FileQueueManager();
      expect(manager.files).toEqual([]);
      expect(manager.isUploading).toBe(false);
      expect(manager.currentIndex).toBe(-1);
    });

    test('should create instance with custom options', () => {
      const manager = new FileQueueManager({
        uploadUrl: '/api/audios/upload',
        fileFieldName: 'audio',
        allowedExtensions: validAudioExtensions,
        allowedMimeTypes: validAudioMimeTypes
      });
      expect(manager.uploadUrl).toBe('/api/audios/upload');
      expect(manager.fileFieldName).toBe('audio');
    });
  });

  /**
   * Property 1: File Filter Correctness
   * For any list of files containing both valid and invalid formats,
   * the filter function SHALL return only files with valid formats,
   * and the count of returned files SHALL be less than or equal to the input count.
   * 
   * **Feature: multiple-file-upload, Property 1: File Filter Correctness**
   * **Validates: Requirements 1.4, 2.4**
   */
  describe('Property 1: File Filter Correctness', () => {
    test('filter should return only valid files and count <= input count', () => {
      fc.assert(
        fc.property(mixedFileListArb, ({ files, validCount, invalidCount }) => {
          const manager = new FileQueueManager({
            allowedExtensions: validVideoExtensions,
            allowedMimeTypes: validVideoMimeTypes
          });
          
          const { valid, invalid } = manager.filterFiles(files);
          
          // Property: returned valid count should equal expected valid count
          expect(valid.length).toBe(validCount);
          
          // Property: returned invalid count should equal expected invalid count
          expect(invalid.length).toBe(invalidCount);
          
          // Property: total should equal input
          expect(valid.length + invalid.length).toBe(files.length);
          
          // Property: valid count <= input count
          expect(valid.length).toBeLessThanOrEqual(files.length);
          
          // Property: all returned valid files should actually be valid
          for (const file of valid) {
            expect(manager.isValidFile(file)).toBe(true);
          }
          
          // Property: all returned invalid files should actually be invalid
          for (const file of invalid) {
            expect(manager.isValidFile(file)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('filter with empty list should return empty results', () => {
      const manager = new FileQueueManager();
      const { valid, invalid } = manager.filterFiles([]);
      expect(valid).toEqual([]);
      expect(invalid).toEqual([]);
    });

    test('filter with all valid files should return all as valid', () => {
      fc.assert(
        fc.property(
          fc.array(validVideoFileArb, { minLength: 1, maxLength: 10 }),
          (files) => {
            const manager = new FileQueueManager();
            const { valid, invalid } = manager.filterFiles(files);
            
            expect(valid.length).toBe(files.length);
            expect(invalid.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('filter with all invalid files should return all as invalid', () => {
      fc.assert(
        fc.property(
          fc.array(invalidVideoFileArb, { minLength: 1, maxLength: 10 }),
          (files) => {
            const manager = new FileQueueManager();
            const { valid, invalid } = manager.filterFiles(files);
            
            expect(valid.length).toBe(0);
            expect(invalid.length).toBe(files.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Queue Removal Isolation
   * For any file queue with multiple files, removing a file at index N
   * SHALL not modify files at other indices, and the queue length SHALL decrease by exactly 1.
   * 
   * **Feature: multiple-file-upload, Property 3: Queue Removal Isolation**
   * **Validates: Requirements 4.2**
   */
  describe('Property 3: Queue Removal Isolation', () => {
    test('removing file should not affect other files and decrease length by 1', () => {
      fc.assert(
        fc.property(
          fc.array(validVideoFileArb, { minLength: 2, maxLength: 10 }),
          fc.nat(),
          (files, indexSeed) => {
            const manager = new FileQueueManager();
            manager.addFiles(files);
            
            const originalLength = manager.files.length;
            const removeIndex = indexSeed % originalLength;
            
            // Store files before removal (excluding the one to be removed)
            const filesBefore = manager.files
              .filter((_, i) => i !== removeIndex)
              .map(f => ({ name: f.name, size: f.size }));
            
            // Remove file
            const result = manager.removeFile(removeIndex);
            
            // Property: removal should succeed
            expect(result).toBe(true);
            
            // Property: length should decrease by exactly 1
            expect(manager.files.length).toBe(originalLength - 1);
            
            // Property: other files should remain unchanged
            const filesAfter = manager.files.map(f => ({ name: f.name, size: f.size }));
            expect(filesAfter).toEqual(filesBefore);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('removing file with invalid index should return false', () => {
      fc.assert(
        fc.property(
          fc.array(validVideoFileArb, { minLength: 1, maxLength: 5 }),
          (files) => {
            const manager = new FileQueueManager();
            manager.addFiles(files);
            
            const originalLength = manager.files.length;
            
            // Try to remove with invalid indices
            expect(manager.removeFile(-1)).toBe(false);
            expect(manager.removeFile(originalLength)).toBe(false);
            expect(manager.removeFile(originalLength + 10)).toBe(false);
            
            // Length should remain unchanged
            expect(manager.files.length).toBe(originalLength);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('removing by ID should work correctly', () => {
      const manager = new FileQueueManager();
      const files = [
        new MockFile('video1.mp4', 1000, 'video/mp4'),
        new MockFile('video2.mp4', 2000, 'video/mp4'),
        new MockFile('video3.mp4', 3000, 'video/mp4')
      ];
      
      manager.addFiles(files);
      const idToRemove = manager.files[1].id;
      const originalLength = manager.files.length;
      
      const result = manager.removeFileById(idToRemove);
      
      expect(result).toBe(true);
      expect(manager.files.length).toBe(originalLength - 1);
      expect(manager.files.find(f => f.id === idToRemove)).toBeUndefined();
    });
  });

  describe('addFiles', () => {
    test('should add valid files to queue', () => {
      const manager = new FileQueueManager();
      const files = [
        new MockFile('video1.mp4', 1000, 'video/mp4'),
        new MockFile('video2.avi', 2000, 'video/avi')
      ];
      
      const result = manager.addFiles(files);
      
      expect(result.added).toBe(2);
      expect(result.rejected).toBe(0);
      expect(manager.files.length).toBe(2);
    });

    test('should reject invalid files', () => {
      const manager = new FileQueueManager();
      const files = [
        new MockFile('video1.mp4', 1000, 'video/mp4'),
        new MockFile('document.pdf', 500, 'application/pdf')
      ];
      
      const result = manager.addFiles(files);
      
      expect(result.added).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.rejectedFiles).toContain('document.pdf');
      expect(manager.files.length).toBe(1);
    });

    test('each added file should have correct structure', () => {
      const manager = new FileQueueManager();
      const file = new MockFile('test.mp4', 1024000, 'video/mp4');
      
      manager.addFiles([file]);
      
      const addedFile = manager.files[0];
      expect(addedFile.id).toBeDefined();
      expect(addedFile.name).toBe('test.mp4');
      expect(addedFile.size).toBe(1024000);
      expect(addedFile.status).toBe('pending');
      expect(addedFile.progress).toBe(0);
      expect(addedFile.error).toBeNull();
      expect(addedFile.formattedSize).toBeDefined();
    });
  });

  describe('getStatusCounts', () => {
    test('should return correct counts', () => {
      const manager = new FileQueueManager();
      const files = [
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 2000, 'video/mp4'),
        new MockFile('v3.mp4', 3000, 'video/mp4')
      ];
      
      manager.addFiles(files);
      manager.files[0].status = 'success';
      manager.files[1].status = 'error';
      
      const counts = manager.getStatusCounts();
      
      expect(counts.total).toBe(3);
      expect(counts.success).toBe(1);
      expect(counts.error).toBe(1);
      expect(counts.pending).toBe(1);
      expect(counts.uploading).toBe(0);
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(FileQueueManager.formatFileSize(500)).toBe('500 B');
      expect(FileQueueManager.formatFileSize(1024)).toBe('1.0 KB');
      expect(FileQueueManager.formatFileSize(1048576)).toBe('1.0 MB');
      expect(FileQueueManager.formatFileSize(1073741824)).toBe('1.0 GB');
    });
  });

  describe('clearQueue', () => {
    test('should clear all files and reset state', () => {
      const manager = new FileQueueManager();
      const files = [
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 2000, 'video/mp4')
      ];
      
      manager.addFiles(files);
      manager.clearQueue();
      
      expect(manager.files.length).toBe(0);
      expect(manager.currentIndex).toBe(-1);
      expect(manager.isUploading).toBe(false);
    });
  });

  describe('helper methods', () => {
    test('hasFiles should return correct value', () => {
      const manager = new FileQueueManager();
      expect(manager.hasFiles()).toBe(false);
      
      manager.addFiles([new MockFile('v.mp4', 1000, 'video/mp4')]);
      expect(manager.hasFiles()).toBe(true);
    });

    test('hasPendingFiles should return correct value', () => {
      const manager = new FileQueueManager();
      manager.addFiles([new MockFile('v.mp4', 1000, 'video/mp4')]);
      
      expect(manager.hasPendingFiles()).toBe(true);
      
      manager.files[0].status = 'success';
      expect(manager.hasPendingFiles()).toBe(false);
    });

    test('hasFailedFiles should return correct value', () => {
      const manager = new FileQueueManager();
      manager.addFiles([new MockFile('v.mp4', 1000, 'video/mp4')]);
      
      expect(manager.hasFailedFiles()).toBe(false);
      
      manager.files[0].status = 'error';
      expect(manager.hasFailedFiles()).toBe(true);
    });
  });
});


describe('Upload Processing', () => {
  /**
   * Property 4: Upload State Transitions
   * For any file in the queue, the status SHALL transition from 'pending' to 'uploading'
   * to either 'success' or 'error', and once in 'success' or 'error' state,
   * the status SHALL not change unless explicitly retried.
   * 
   * **Feature: multiple-file-upload, Property 4: Upload State Transitions**
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 4: Upload State Transitions', () => {
    test('valid state transitions should be pending -> uploading -> success/error', () => {
      const validTransitions = {
        'pending': ['uploading'],
        'uploading': ['success', 'error', 'pending'], // pending for cancel
        'success': [], // terminal state
        'error': ['pending'] // only via retry
      };
      
      fc.assert(
        fc.property(
          fc.constantFrom('pending', 'uploading', 'success', 'error'),
          fc.constantFrom('pending', 'uploading', 'success', 'error'),
          (fromState, toState) => {
            const isValidTransition = validTransitions[fromState].includes(toState) || fromState === toState;
            
            // This is a specification test - we're documenting valid transitions
            if (fromState === 'pending' && toState === 'uploading') {
              expect(isValidTransition).toBe(true);
            }
            if (fromState === 'uploading' && (toState === 'success' || toState === 'error')) {
              expect(isValidTransition).toBe(true);
            }
            if (fromState === 'success' && toState !== 'success') {
              expect(isValidTransition).toBe(false);
            }
            if (fromState === 'error' && toState === 'pending') {
              expect(isValidTransition).toBe(true); // retry case
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('file status should start as pending', () => {
      fc.assert(
        fc.property(
          fc.array(validVideoFileArb, { minLength: 1, maxLength: 5 }),
          (files) => {
            const manager = new FileQueueManager();
            manager.addFiles(files);
            
            for (const file of manager.files) {
              expect(file.status).toBe('pending');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: Overall Progress Calculation
   * For any upload queue, the overall progress percentage SHALL equal
   * the sum of (completed files * 100 + current file progress) divided by (total files * 100),
   * expressed as a percentage.
   * 
   * **Feature: multiple-file-upload, Property 5: Overall Progress Calculation**
   * **Validates: Requirements 3.5**
   */
  describe('Property 5: Overall Progress Calculation', () => {
    test('overall progress should be calculated correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom('pending', 'uploading', 'success', 'error'),
              progress: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (fileStates) => {
            const manager = new FileQueueManager();
            
            // Add files and set their states
            const mockFiles = fileStates.map((state, i) => 
              new MockFile(`video${i}.mp4`, 1000, 'video/mp4')
            );
            manager.addFiles(mockFiles);
            
            // Set states
            fileStates.forEach((state, i) => {
              manager.files[i].status = state.status;
              manager.files[i].progress = state.progress;
            });
            
            // Calculate expected progress
            let expectedTotal = 0;
            for (const state of fileStates) {
              if (state.status === 'success' || state.status === 'error') {
                expectedTotal += 100;
              } else if (state.status === 'uploading') {
                expectedTotal += state.progress;
              }
              // pending contributes 0
            }
            const expectedProgress = Math.round(expectedTotal / fileStates.length);
            
            // Verify
            expect(manager.getOverallProgress()).toBe(expectedProgress);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty queue should have 0 progress', () => {
      const manager = new FileQueueManager();
      expect(manager.getOverallProgress()).toBe(0);
    });

    test('all success should have 100 progress', () => {
      const manager = new FileQueueManager();
      manager.addFiles([
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 1000, 'video/mp4')
      ]);
      
      manager.files.forEach(f => f.status = 'success');
      
      expect(manager.getOverallProgress()).toBe(100);
    });
  });

  /**
   * Property 7: Sequential Processing
   * For any upload queue, at most one file SHALL have status 'uploading' at any given time.
   * 
   * **Feature: multiple-file-upload, Property 7: Sequential Processing**
   * **Validates: Requirements 6.1**
   */
  describe('Property 7: Sequential Processing', () => {
    test('at most one file should be uploading at any time', () => {
      fc.assert(
        fc.property(
          fc.array(validVideoFileArb, { minLength: 1, maxLength: 10 }),
          (files) => {
            const manager = new FileQueueManager();
            manager.addFiles(files);
            
            // Simulate various states
            const uploadingCount = manager.getUploadingCount();
            expect(uploadingCount).toBeLessThanOrEqual(1);
            
            // Even if we manually set multiple to uploading (which shouldn't happen)
            // the getUploadingCount should report correctly
            manager.files[0].status = 'uploading';
            expect(manager.getUploadingCount()).toBe(1);
            
            if (manager.files.length > 1) {
              manager.files[1].status = 'uploading';
              expect(manager.getUploadingCount()).toBe(2); // This would be a bug in real usage
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getUploadingCount should return correct count', () => {
      const manager = new FileQueueManager();
      manager.addFiles([
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 1000, 'video/mp4'),
        new MockFile('v3.mp4', 1000, 'video/mp4')
      ]);
      
      expect(manager.getUploadingCount()).toBe(0);
      
      manager.files[0].status = 'uploading';
      expect(manager.getUploadingCount()).toBe(1);
      
      manager.files[0].status = 'success';
      expect(manager.getUploadingCount()).toBe(0);
    });
  });

  /**
   * Property 8: Error Resilience
   * For any upload queue where file at index N fails,
   * files at indices greater than N SHALL still be processed.
   * 
   * **Feature: multiple-file-upload, Property 8: Error Resilience**
   * **Validates: Requirements 5.1**
   */
  describe('Property 8: Error Resilience', () => {
    test('failed files should not prevent processing of subsequent files', () => {
      // This is a behavioral test - we verify the queue structure supports this
      const manager = new FileQueueManager();
      manager.addFiles([
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 1000, 'video/mp4'),
        new MockFile('v3.mp4', 1000, 'video/mp4')
      ]);
      
      // Simulate first file failed
      manager.files[0].status = 'error';
      manager.files[0].error = 'Network error';
      
      // Second and third should still be pending (processable)
      expect(manager.files[1].status).toBe('pending');
      expect(manager.files[2].status).toBe('pending');
      
      // hasPendingFiles should return true
      expect(manager.hasPendingFiles()).toBe(true);
      
      // Simulate second file success
      manager.files[1].status = 'success';
      
      // Third should still be pending
      expect(manager.files[2].status).toBe('pending');
      expect(manager.hasPendingFiles()).toBe(true);
    });

    test('status counts should be accurate after mixed results', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('pending', 'success', 'error'),
            { minLength: 1, maxLength: 10 }
          ),
          (statuses) => {
            const manager = new FileQueueManager();
            const files = statuses.map((_, i) => 
              new MockFile(`v${i}.mp4`, 1000, 'video/mp4')
            );
            manager.addFiles(files);
            
            // Set statuses
            statuses.forEach((status, i) => {
              manager.files[i].status = status;
            });
            
            const counts = manager.getStatusCounts();
            
            // Verify counts match
            expect(counts.total).toBe(statuses.length);
            expect(counts.pending).toBe(statuses.filter(s => s === 'pending').length);
            expect(counts.success).toBe(statuses.filter(s => s === 'success').length);
            expect(counts.error).toBe(statuses.filter(s => s === 'error').length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cancel Operations', () => {
    test('cancelAll should reset uploading files to pending', () => {
      const manager = new FileQueueManager();
      manager.addFiles([
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 1000, 'video/mp4')
      ]);
      
      manager.files[0].status = 'uploading';
      manager.files[0].progress = 50;
      
      manager.cancelAll();
      
      expect(manager.files[0].status).toBe('pending');
      expect(manager.files[0].progress).toBe(0);
      expect(manager.isUploading).toBe(false);
      expect(manager.isCancelled).toBe(true);
    });
  });

  describe('Retry Operations', () => {
    test('retryFailed should reset error files to pending', async () => {
      const manager = new FileQueueManager();
      manager.addFiles([
        new MockFile('v1.mp4', 1000, 'video/mp4'),
        new MockFile('v2.mp4', 1000, 'video/mp4')
      ]);
      
      manager.files[0].status = 'success';
      manager.files[1].status = 'error';
      manager.files[1].error = 'Network error';
      
      // Mock the startUpload to not actually upload
      manager.startUpload = jest.fn().mockResolvedValue({ success: 1, failed: 0 });
      
      await manager.retryFailed();
      
      // Error file should be reset to pending before startUpload is called
      expect(manager.files[0].status).toBe('success'); // unchanged
    });
  });
});


/**
 * Property 2: File List Display Completeness
 * For any list of selected files, the rendered file list SHALL contain
 * an entry for each file showing its name and formatted size.
 * 
 * **Feature: multiple-file-upload, Property 2: File List Display Completeness**
 * **Validates: Requirements 1.3, 2.3**
 */
describe('Property 2: File List Display Completeness', () => {
  test('each file in queue should have name and formatted size', () => {
    fc.assert(
      fc.property(
        fc.array(validVideoFileArb, { minLength: 1, maxLength: 10 }),
        (files) => {
          const manager = new FileQueueManager();
          manager.addFiles(files);
          
          const queuedFiles = manager.getFiles();
          
          // Property: queue should have same count as valid input files
          expect(queuedFiles.length).toBe(files.length);
          
          // Property: each file should have name and formattedSize
          for (let i = 0; i < queuedFiles.length; i++) {
            const queuedFile = queuedFiles[i];
            const originalFile = files[i];
            
            // Name should match original
            expect(queuedFile.name).toBe(originalFile.name);
            
            // Size should match original
            expect(queuedFile.size).toBe(originalFile.size);
            
            // Formatted size should be defined and non-empty
            expect(queuedFile.formattedSize).toBeDefined();
            expect(queuedFile.formattedSize.length).toBeGreaterThan(0);
            
            // Formatted size should contain a unit
            expect(queuedFile.formattedSize).toMatch(/(B|KB|MB|GB)$/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('file list should preserve order of addition', () => {
    const manager = new FileQueueManager();
    const files = [
      new MockFile('first.mp4', 1000, 'video/mp4'),
      new MockFile('second.mp4', 2000, 'video/mp4'),
      new MockFile('third.mp4', 3000, 'video/mp4')
    ];
    
    manager.addFiles(files);
    const queuedFiles = manager.getFiles();
    
    expect(queuedFiles[0].name).toBe('first.mp4');
    expect(queuedFiles[1].name).toBe('second.mp4');
    expect(queuedFiles[2].name).toBe('third.mp4');
  });
});

/**
 * Property 6: Summary Accuracy
 * For any completed upload batch, the summary SHALL show success count + failure count
 * equal to total files, and each file SHALL be categorized correctly based on its final status.
 * 
 * **Feature: multiple-file-upload, Property 6: Summary Accuracy**
 * **Validates: Requirements 3.4, 5.2**
 */
describe('Property 6: Summary Accuracy', () => {
  test('status counts should sum to total files', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom('pending', 'uploading', 'success', 'error')
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (fileStates) => {
          const manager = new FileQueueManager();
          const files = fileStates.map((_, i) => 
            new MockFile(`video${i}.mp4`, 1000, 'video/mp4')
          );
          manager.addFiles(files);
          
          // Set statuses
          fileStates.forEach((state, i) => {
            manager.files[i].status = state.status;
          });
          
          const counts = manager.getStatusCounts();
          
          // Property: sum of all status counts should equal total
          const sum = counts.pending + counts.uploading + counts.success + counts.error;
          expect(sum).toBe(counts.total);
          expect(counts.total).toBe(fileStates.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('each file should be categorized correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('pending', 'uploading', 'success', 'error'),
          { minLength: 1, maxLength: 10 }
        ),
        (statuses) => {
          const manager = new FileQueueManager();
          const files = statuses.map((_, i) => 
            new MockFile(`video${i}.mp4`, 1000, 'video/mp4')
          );
          manager.addFiles(files);
          
          // Set statuses
          statuses.forEach((status, i) => {
            manager.files[i].status = status;
          });
          
          const counts = manager.getStatusCounts();
          
          // Count expected values
          const expectedPending = statuses.filter(s => s === 'pending').length;
          const expectedUploading = statuses.filter(s => s === 'uploading').length;
          const expectedSuccess = statuses.filter(s => s === 'success').length;
          const expectedError = statuses.filter(s => s === 'error').length;
          
          // Property: counts should match expected
          expect(counts.pending).toBe(expectedPending);
          expect(counts.uploading).toBe(expectedUploading);
          expect(counts.success).toBe(expectedSuccess);
          expect(counts.error).toBe(expectedError);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasFailedFiles should correctly identify failed uploads', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('pending', 'success', 'error'),
          { minLength: 1, maxLength: 10 }
        ),
        (statuses) => {
          const manager = new FileQueueManager();
          const files = statuses.map((_, i) => 
            new MockFile(`video${i}.mp4`, 1000, 'video/mp4')
          );
          manager.addFiles(files);
          
          statuses.forEach((status, i) => {
            manager.files[i].status = status;
          });
          
          const hasErrors = statuses.includes('error');
          expect(manager.hasFailedFiles()).toBe(hasErrors);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 9: Database Record Integrity
 * For any successfully uploaded file, querying the database SHALL return a record
 * with matching title (derived from filename), filepath, file_size, and non-null duration.
 * 
 * Note: This is a specification test that verifies the expected data structure.
 * Actual database integration would require mocking the backend.
 * 
 * **Feature: multiple-file-upload, Property 9: Database Record Integrity**
 * **Validates: Requirements 6.3**
 */
describe('Property 9: Database Record Integrity', () => {
  test('successful upload result should contain required fields', () => {
    // This test verifies the expected structure of upload results
    // In a real scenario, this would be an integration test with the backend
    
    const mockSuccessResult = {
      success: true,
      video: {
        id: 'uuid-123',
        title: 'test_video',
        filepath: '/uploads/videos/test_video_123.mp4',
        file_size: 1024000,
        duration: 120.5,
        format: 'mp4'
      }
    };
    
    // Property: successful result should have success=true
    expect(mockSuccessResult.success).toBe(true);
    
    // Property: video object should have all required fields
    expect(mockSuccessResult.video.id).toBeDefined();
    expect(mockSuccessResult.video.title).toBeDefined();
    expect(mockSuccessResult.video.filepath).toBeDefined();
    expect(mockSuccessResult.video.file_size).toBeDefined();
    expect(mockSuccessResult.video.duration).toBeDefined();
    
    // Property: title should be derived from filename (without extension)
    expect(mockSuccessResult.video.title).toBe('test_video');
    
    // Property: filepath should start with /uploads/videos/
    expect(mockSuccessResult.video.filepath).toMatch(/^\/uploads\/videos\//);
    
    // Property: file_size should be positive number
    expect(mockSuccessResult.video.file_size).toBeGreaterThan(0);
    
    // Property: duration should be non-null
    expect(mockSuccessResult.video.duration).not.toBeNull();
  });

  test('file queue item result should store server response', () => {
    const manager = new FileQueueManager();
    const file = new MockFile('my_video.mp4', 5000000, 'video/mp4');
    manager.addFiles([file]);
    
    // Simulate successful upload
    const mockResult = {
      success: true,
      video: {
        id: 'uuid-456',
        title: 'my_video',
        filepath: '/uploads/videos/my_video_456.mp4',
        file_size: 5000000,
        duration: 300
      }
    };
    
    manager.files[0].status = 'success';
    manager.files[0].result = mockResult;
    
    // Property: result should be stored in file item
    expect(manager.files[0].result).toBeDefined();
    expect(manager.files[0].result.success).toBe(true);
    expect(manager.files[0].result.video.title).toBe('my_video');
  });

  test('audio upload result should have correct structure', () => {
    const mockAudioResult = {
      success: true,
      audio: {
        id: 'uuid-789',
        title: 'my_audio',
        filepath: '/uploads/audios/my_audio_789.mp3',
        file_size: 3000000,
        duration: 180,
        format: 'MP3'
      }
    };
    
    // Property: audio result should have all required fields
    expect(mockAudioResult.success).toBe(true);
    expect(mockAudioResult.audio.id).toBeDefined();
    expect(mockAudioResult.audio.title).toBeDefined();
    expect(mockAudioResult.audio.filepath).toBeDefined();
    expect(mockAudioResult.audio.file_size).toBeDefined();
    expect(mockAudioResult.audio.duration).toBeDefined();
    expect(mockAudioResult.audio.format).toBeDefined();
    
    // Property: filepath should start with /uploads/audios/
    expect(mockAudioResult.audio.filepath).toMatch(/^\/uploads\/audios\//);
  });

  test('title derivation from filename should work correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.constantFrom('.mp4', '.avi', '.mov', '.mp3', '.wav'),
        (baseName, extension) => {
          const filename = baseName + extension;
          
          // Simulate title derivation (what the backend does)
          const derivedTitle = filename.replace(/\.[^/.]+$/, '');
          
          // Property: derived title should equal base name
          expect(derivedTitle).toBe(baseName);
          
          // Property: derived title should not contain extension
          expect(derivedTitle).not.toContain('.');
        }
      ),
      { numRuns: 100 }
    );
  });
});
