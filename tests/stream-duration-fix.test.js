/**
 * Property-Based Tests for Stream Duration Fix Feature
 * 
 * These tests validate the correctness properties defined in the design document.
 * Using fast-check for property-based testing.
 * 
 * **Feature: stream-duration-fix**
 */

const fc = require('fast-check');

// Standalone implementations of FFmpeg args builders for testing
// These mirror the actual implementations in streamingService.js

/**
 * Build FFmpeg args for video + separate audio streaming (test version)
 */
function buildFFmpegArgsWithAudio(videoPath, audioPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = [
    '-hwaccel', 'auto',
    '-loglevel', 'error',
    '-re',
    '-fflags', '+genpts+igndts',
    '-avoid_negative_ts', 'make_zero'
  ];
  
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', videoPath);
  
  args.push('-stream_loop', '-1');
  args.push('-i', audioPath);
  
  args.push('-map', '0:v:0');
  args.push('-map', '1:a:0');
  args.push('-c:v', 'copy');
  args.push('-c:a', 'aac');
  args.push('-b:a', '128k');
  args.push('-ar', '44100');
  args.push('-flags', '+global_header');
  args.push('-bufsize', '4M');
  args.push('-max_muxing_queue_size', '7000');
  args.push('-f', 'flv');
  
  // CRITICAL: Duration limit (-t) must be placed just before output URL
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
  }
  
  args.push(rtmpUrl);
  
  return args;
}

/**
 * Build FFmpeg args for video only streaming (test version)
 */
function buildFFmpegArgsVideoOnly(videoPath, rtmpUrl, durationSeconds, loopVideo) {
  const args = [
    '-hwaccel', 'auto',
    '-loglevel', 'error',
    '-re',
    '-fflags', '+genpts+igndts',
    '-avoid_negative_ts', 'make_zero'
  ];
  
  if (loopVideo) {
    args.push('-stream_loop', '-1');
  } else {
    args.push('-stream_loop', '0');
  }
  args.push('-i', videoPath);
  
  args.push('-c:v', 'copy');
  args.push('-c:a', 'copy');
  args.push('-flags', '+global_header');
  args.push('-bufsize', '4M');
  args.push('-max_muxing_queue_size', '7000');
  args.push('-f', 'flv');
  
  // CRITICAL: Duration limit (-t) must be placed just before output URL
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
  }
  
  args.push(rtmpUrl);
  
  return args;
}

/**
 * Helper function to calculate expected end time
 * @param {Date} startTime - Start time
 * @param {number} durationHours - Duration in hours
 * @returns {Date} Expected end time
 */
function calculateExpectedEndTime(startTime, durationHours) {
  if (!startTime || !durationHours || durationHours <= 0) return null;
  return new Date(startTime.getTime() + durationHours * 3600 * 1000);
}

/**
 * Helper function to calculate remaining time
 * @param {Date} expectedEndTime - Expected end time
 * @param {Date} currentTime - Current time
 * @returns {number|null} Remaining time in milliseconds, or null if no end time
 */
function calculateRemainingTime(expectedEndTime, currentTime) {
  if (!expectedEndTime) return null;
  return Math.max(0, expectedEndTime.getTime() - currentTime.getTime());
}

/**
 * Helper function to check if stream is ending soon (< 5 minutes)
 * @param {number} remainingMs - Remaining time in milliseconds
 * @returns {boolean} True if ending soon
 */
function isStreamEndingSoon(remainingMs) {
  if (remainingMs === null) return false;
  return remainingMs < 300000; // 5 minutes in ms
}

/**
 * Helper function to check if duration is exceeded
 * @param {Date} expectedEndTime - Expected end time
 * @param {Date} currentTime - Current time
 * @returns {boolean} True if duration exceeded
 */
function isStreamDurationExceeded(expectedEndTime, currentTime) {
  if (!expectedEndTime) return false;
  return currentTime >= expectedEndTime;
}

/**
 * Helper function to find -t parameter position in FFmpeg args
 * @param {Array} args - FFmpeg arguments array
 * @returns {number} Index of -t parameter, or -1 if not found
 */
function findDurationParamIndex(args) {
  return args.indexOf('-t');
}

/**
 * Helper function to find output URL position in FFmpeg args
 * @param {Array} args - FFmpeg arguments array
 * @returns {number} Index of output URL (last element), or -1 if empty
 */
function findOutputUrlIndex(args) {
  if (args.length === 0) return -1;
  return args.length - 1;
}

describe('Stream Duration Fix Feature - Property Tests', () => {
  
  describe('Property 5: Dual Mechanism Activation - FFmpeg Args', () => {
    // **Validates: Requirements 2.1**
    // *For any* stream started with a duration, the FFmpeg arguments SHALL contain 
    // the -t parameter with correct duration value
    
    test('buildFFmpegArgsVideoOnly should include -t parameter when duration is set', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week in hours
          fc.boolean(),
          (durationHours, loopVideo) => {
            const durationSeconds = durationHours * 3600;
            const args = buildFFmpegArgsVideoOnly(
              '/path/to/video.mp4',
              'rtmp://server/live/key',
              durationSeconds,
              loopVideo
            );
            
            // -t parameter should exist
            const tIndex = findDurationParamIndex(args);
            if (tIndex === -1) return false;
            
            // -t value should match duration in seconds
            const tValue = args[tIndex + 1];
            return tValue === durationSeconds.toString();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('buildFFmpegArgsWithAudio should include -t parameter when duration is set', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week in hours
          fc.boolean(),
          (durationHours, loopVideo) => {
            const durationSeconds = durationHours * 3600;
            const args = buildFFmpegArgsWithAudio(
              '/path/to/video.mp4',
              '/path/to/audio.mp3',
              'rtmp://server/live/key',
              durationSeconds,
              loopVideo
            );
            
            // -t parameter should exist
            const tIndex = findDurationParamIndex(args);
            if (tIndex === -1) return false;
            
            // -t value should match duration in seconds
            const tValue = args[tIndex + 1];
            return tValue === durationSeconds.toString();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('-t parameter should be placed just before output URL in buildFFmpegArgsVideoOnly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          fc.boolean(),
          (durationHours, loopVideo) => {
            const durationSeconds = durationHours * 3600;
            const rtmpUrl = 'rtmp://server/live/key';
            const args = buildFFmpegArgsVideoOnly(
              '/path/to/video.mp4',
              rtmpUrl,
              durationSeconds,
              loopVideo
            );
            
            const tIndex = findDurationParamIndex(args);
            const outputIndex = findOutputUrlIndex(args);
            
            // -t should be at position outputIndex - 2 (because -t VALUE URL)
            // So -t is at outputIndex - 2, VALUE is at outputIndex - 1, URL is at outputIndex
            return tIndex === outputIndex - 2 && args[outputIndex] === rtmpUrl;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('-t parameter should be placed just before output URL in buildFFmpegArgsWithAudio', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 168 }),
          fc.boolean(),
          (durationHours, loopVideo) => {
            const durationSeconds = durationHours * 3600;
            const rtmpUrl = 'rtmp://server/live/key';
            const args = buildFFmpegArgsWithAudio(
              '/path/to/video.mp4',
              '/path/to/audio.mp3',
              rtmpUrl,
              durationSeconds,
              loopVideo
            );
            
            const tIndex = findDurationParamIndex(args);
            const outputIndex = findOutputUrlIndex(args);
            
            // -t should be at position outputIndex - 2
            return tIndex === outputIndex - 2 && args[outputIndex] === rtmpUrl;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no -t parameter when duration is null or zero', () => {
      const argsNullDuration = buildFFmpegArgsVideoOnly(
        '/path/to/video.mp4',
        'rtmp://server/live/key',
        null,
        true
      );
      expect(findDurationParamIndex(argsNullDuration)).toBe(-1);

      const argsZeroDuration = buildFFmpegArgsVideoOnly(
        '/path/to/video.mp4',
        'rtmp://server/live/key',
        0,
        true
      );
      expect(findDurationParamIndex(argsZeroDuration)).toBe(-1);
    });
  });

  describe('Property 1: End Time Calculation Correctness', () => {
    // **Validates: Requirements 1.1, 3.1**
    // *For any* stream with a valid start time and duration in hours, 
    // the calculated expected end time SHALL equal start time plus (duration × 3600 × 1000) milliseconds
    
    test('expected end time should equal start time plus duration in milliseconds', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week
          (startTime, durationHours) => {
            if (isNaN(startTime.getTime())) return true;
            
            const expectedEndTime = calculateExpectedEndTime(startTime, durationHours);
            const expectedMs = startTime.getTime() + durationHours * 3600 * 1000;
            
            return expectedEndTime.getTime() === expectedMs;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('remaining time should equal expected end time minus current time', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }),
          fc.integer({ min: 0, max: 167 }), // elapsed hours (less than duration)
          (startTime, durationHours, elapsedHours) => {
            if (isNaN(startTime.getTime())) return true;
            if (elapsedHours >= durationHours) return true; // skip if elapsed >= duration
            
            const expectedEndTime = calculateExpectedEndTime(startTime, durationHours);
            const currentTime = new Date(startTime.getTime() + elapsedHours * 3600 * 1000);
            const remainingMs = calculateRemainingTime(expectedEndTime, currentTime);
            
            const expectedRemainingMs = expectedEndTime.getTime() - currentTime.getTime();
            return remainingMs === expectedRemainingMs;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Warning Threshold Detection', () => {
    // **Validates: Requirements 3.2**
    // *For any* stream with remaining time less than 5 minutes (300000 milliseconds), 
    // the system SHALL indicate that the stream is about to end
    
    test('should return true when remaining time is less than 5 minutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 299999 }), // 0 to just under 5 minutes
          (remainingMs) => {
            return isStreamEndingSoon(remainingMs) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return false when remaining time is 5 minutes or more', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 300000, max: 86400000 }), // 5 minutes to 24 hours
          (remainingMs) => {
            return isStreamEndingSoon(remainingMs) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return false when remaining time is null', () => {
      expect(isStreamEndingSoon(null)).toBe(false);
    });

    test('boundary test: exactly 5 minutes should not trigger warning', () => {
      expect(isStreamEndingSoon(300000)).toBe(false);
    });

    test('boundary test: 4:59 should trigger warning', () => {
      expect(isStreamEndingSoon(299000)).toBe(true);
    });
  });

  describe('Property 4: No Restart on Normal Duration Exit', () => {
    // **Validates: Requirements 1.4**
    // *For any* FFmpeg process that exits with code 0 when the stream duration 
    // has been reached or exceeded, the system SHALL NOT attempt to restart
    
    test('duration exceeded check should return true when current time >= expected end time', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 1, max: 168 }),
          fc.integer({ min: 0, max: 24 }), // extra hours past duration
          (startTime, durationHours, extraHours) => {
            if (isNaN(startTime.getTime())) return true;
            
            const expectedEndTime = calculateExpectedEndTime(startTime, durationHours);
            // Current time is at or past expected end time
            const currentTime = new Date(expectedEndTime.getTime() + extraHours * 3600 * 1000);
            
            return isStreamDurationExceeded(expectedEndTime, currentTime) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('duration exceeded check should return false when current time < expected end time', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.integer({ min: 2, max: 168 }), // at least 2 hours
          fc.integer({ min: 1, max: 167 }), // elapsed hours (less than duration)
          (startTime, durationHours, elapsedHours) => {
            if (isNaN(startTime.getTime())) return true;
            if (elapsedHours >= durationHours) return true; // skip invalid cases
            
            const expectedEndTime = calculateExpectedEndTime(startTime, durationHours);
            const currentTime = new Date(startTime.getTime() + elapsedHours * 3600 * 1000);
            
            return isStreamDurationExceeded(expectedEndTime, currentTime) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('duration exceeded check should return false when no expected end time', () => {
      expect(isStreamDurationExceeded(null, new Date())).toBe(false);
    });
  });
});

// Export helper functions for use in application
module.exports = {
  calculateExpectedEndTime,
  calculateRemainingTime,
  isStreamEndingSoon,
  isStreamDurationExceeded,
  findDurationParamIndex,
  findOutputUrlIndex
};
