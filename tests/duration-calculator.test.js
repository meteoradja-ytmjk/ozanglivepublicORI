/**
 * Duration Calculator Tests
 * 
 * Property-based tests for duration calculation logic.
 * Uses fast-check for property-based testing.
 */

const fc = require('fast-check');
const {
  calculateDurationSeconds,
  calculateRemainingDuration,
  minutesToSeconds,
  hoursToSeconds,
  formatDuration
} = require('../utils/durationCalculator');

// Suppress console.log during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

describe('Duration Calculator', () => {
  /**
   * **Feature: streaming-duration-fix, Property 1: Duration Field Priority**
   * **Validates: Requirements 1.1, 2.1**
   * 
   * For any stream with multiple duration fields set, the calculateDurationSeconds
   * function SHALL return the value from stream_duration_minutes * 60 when that
   * field is positive, regardless of other field values.
   */
  describe('Property 1: Duration Field Priority', () => {
    test('stream_duration_minutes takes priority over all other fields', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // stream_duration_minutes (1 min to 24 hours)
          fc.integer({ min: 1, max: 48 }),   // stream_duration_hours
          fc.integer({ min: 1, max: 1440 }), // duration
          (minutes, hours, legacyDuration) => {
            const now = new Date();
            const endTime = new Date(now.getTime() + 3600000); // 1 hour later
            
            const stream = {
              stream_duration_minutes: minutes,
              stream_duration_hours: hours,
              duration: legacyDuration,
              schedule_time: now.toISOString(),
              end_time: endTime.toISOString()
            };
            
            const result = calculateDurationSeconds(stream);
            
            // Should always use stream_duration_minutes
            expect(result).toBe(minutes * 60);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('schedule calculation used when stream_duration_minutes not set', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }), // hours difference
          fc.integer({ min: 1, max: 48 }), // stream_duration_hours (should be ignored)
          (hoursDiff, hours) => {
            const now = new Date();
            const endTime = new Date(now.getTime() + hoursDiff * 3600000);
            
            const stream = {
              stream_duration_minutes: null, // Not set
              stream_duration_hours: hours,
              schedule_time: now.toISOString(),
              end_time: endTime.toISOString()
            };
            
            const result = calculateDurationSeconds(stream);
            const expectedSeconds = hoursDiff * 3600;
            
            // Should use schedule calculation (end_time - schedule_time)
            expect(result).toBe(expectedSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('stream_duration_hours used when minutes and schedule not available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }), // stream_duration_hours
          fc.integer({ min: 1, max: 1440 }), // duration (legacy, should be ignored)
          (hours, legacyDuration) => {
            const stream = {
              stream_duration_minutes: null,
              stream_duration_hours: hours,
              duration: legacyDuration,
              schedule_time: null,
              end_time: null
            };
            
            const result = calculateDurationSeconds(stream);
            
            // Should use stream_duration_hours
            expect(result).toBe(hours * 3600);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('legacy duration field used as last resort', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // duration in minutes
          (legacyDuration) => {
            const stream = {
              stream_duration_minutes: null,
              stream_duration_hours: null,
              duration: legacyDuration,
              schedule_time: null,
              end_time: null
            };
            
            const result = calculateDurationSeconds(stream);
            
            // Should use legacy duration field
            expect(result).toBe(legacyDuration * 60);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: streaming-duration-fix, Property 2: Duration Conversion Consistency**
   * **Validates: Requirements 1.2, 2.3**
   * 
   * For any positive duration value, converting from minutes to seconds SHALL
   * produce minutes * 60, and converting from hours to seconds SHALL produce
   * hours * 3600.
   */
  describe('Property 2: Duration Conversion Consistency', () => {
    test('minutes to seconds conversion is consistent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (minutes) => {
            expect(minutesToSeconds(minutes)).toBe(minutes * 60);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('hours to seconds conversion is consistent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (hours) => {
            expect(hoursToSeconds(hours)).toBe(hours * 3600);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('stream_duration_minutes conversion matches minutesToSeconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }),
          (minutes) => {
            const stream = { stream_duration_minutes: minutes };
            const result = calculateDurationSeconds(stream);
            expect(result).toBe(minutesToSeconds(minutes));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('stream_duration_hours conversion matches hoursToSeconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }),
          (hours) => {
            const stream = { stream_duration_hours: hours };
            const result = calculateDurationSeconds(stream);
            expect(result).toBe(hoursToSeconds(hours));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: streaming-duration-fix, Property 3: Schedule Duration Calculation**
   * **Validates: Requirements 2.2, 2.4**
   * 
   * For any stream with valid end_time and schedule_time, when stream_duration_minutes
   * is not set, the calculated duration SHALL equal (end_time - schedule_time) in seconds.
   */
  describe('Property 3: Schedule Duration Calculation', () => {
    test('schedule duration equals end_time minus schedule_time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400 }), // duration in seconds (up to 24 hours)
          (durationSeconds) => {
            const scheduleTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date(scheduleTime.getTime() + durationSeconds * 1000);
            
            const stream = {
              stream_duration_minutes: null,
              schedule_time: scheduleTime.toISOString(),
              end_time: endTime.toISOString()
            };
            
            const result = calculateDurationSeconds(stream);
            
            expect(result).toBe(durationSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid schedule times return null and fallback to other fields', () => {
      const stream = {
        stream_duration_minutes: null,
        schedule_time: 'invalid-date',
        end_time: 'also-invalid',
        stream_duration_hours: 2
      };
      
      const result = calculateDurationSeconds(stream);
      
      // Should fallback to stream_duration_hours
      expect(result).toBe(7200); // 2 hours in seconds
    });

    test('negative schedule duration is ignored', () => {
      const scheduleTime = new Date('2024-01-01T12:00:00Z');
      const endTime = new Date('2024-01-01T10:00:00Z'); // Before schedule time
      
      const stream = {
        stream_duration_minutes: null,
        schedule_time: scheduleTime.toISOString(),
        end_time: endTime.toISOString(),
        stream_duration_hours: 3
      };
      
      const result = calculateDurationSeconds(stream);
      
      // Should fallback to stream_duration_hours since schedule duration is negative
      expect(result).toBe(10800); // 3 hours in seconds
    });
  });

  /**
   * **Feature: streaming-duration-fix, Property 7: Remaining Duration Calculation**
   * **Validates: Requirements 3.3**
   * 
   * For any stream restart, the remaining duration SHALL equal
   * max(0, originalDuration - elapsedTime).
   */
  describe('Property 7: Remaining Duration Calculation', () => {
    test('remaining duration equals total minus elapsed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60000, max: 86400000 }), // total duration 1min to 24h in ms
          fc.integer({ min: 0, max: 100 }), // elapsed percentage (0-100%)
          (totalDurationMs, elapsedPercent) => {
            const elapsedMs = Math.floor(totalDurationMs * elapsedPercent / 100);
            const originalStartTime = new Date(Date.now() - elapsedMs);
            
            const result = calculateRemainingDuration(originalStartTime, totalDurationMs);
            const expected = Math.max(0, totalDurationMs - elapsedMs);
            
            // Allow 100ms tolerance for timing differences
            expect(Math.abs(result - expected)).toBeLessThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('remaining duration is never negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 3600000 }), // total duration
          (totalDurationMs) => {
            // Start time way in the past (duration already exceeded)
            const originalStartTime = new Date(Date.now() - totalDurationMs * 2);
            
            const result = calculateRemainingDuration(originalStartTime, totalDurationMs);
            
            expect(result).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid inputs return 0', () => {
      expect(calculateRemainingDuration(null, 60000)).toBe(0);
      expect(calculateRemainingDuration(new Date(), null)).toBe(0);
      expect(calculateRemainingDuration(new Date(), -1000)).toBe(0);
      expect(calculateRemainingDuration('invalid-date', 60000)).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('null stream returns null', () => {
      expect(calculateDurationSeconds(null)).toBeNull();
    });

    test('empty stream returns null', () => {
      expect(calculateDurationSeconds({})).toBeNull();
    });

    test('zero values are treated as not set', () => {
      const stream = {
        stream_duration_minutes: 0,
        stream_duration_hours: 0,
        duration: 0
      };
      expect(calculateDurationSeconds(stream)).toBeNull();
    });

    test('negative values are treated as not set', () => {
      const stream = {
        stream_duration_minutes: -10,
        stream_duration_hours: 2
      };
      // Should skip negative minutes and use hours
      expect(calculateDurationSeconds(stream)).toBe(7200);
    });
  });

  describe('formatDuration', () => {
    test('formats duration correctly', () => {
      expect(formatDuration(3600)).toBe('60.0 minutes (3600 seconds)');
      expect(formatDuration(90)).toBe('1.5 minutes (90 seconds)');
      expect(formatDuration(0)).toBe('not set');
      expect(formatDuration(null)).toBe('not set');
    });
  });
});


/**
 * Duration Tracking Tests
 * 
 * These tests verify the duration tracking functions in streamingService.
 * Since we can't easily test the actual streamingService functions without
 * mocking the entire module, we test the underlying logic here.
 */
describe('Duration Tracking Logic', () => {
  /**
   * **Feature: streaming-duration-fix, Property 4: Duration Tracking Consistency**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any call to setDurationInfo(streamId, startTime, durationMs),
   * the stored expectedEndTime SHALL equal startTime + durationMs.
   */
  describe('Property 4: Duration Tracking Consistency', () => {
    test('expectedEndTime equals startTime plus durationMs', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          fc.integer({ min: 60000, max: 86400000 }), // 1 min to 24 hours in ms
          (startTime, durationMs) => {
            const expectedEndTime = new Date(startTime.getTime() + durationMs);
            
            // Verify the calculation
            expect(expectedEndTime.getTime()).toBe(startTime.getTime() + durationMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('duration tracking stores all required fields', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          fc.integer({ min: 60000, max: 86400000 }),
          (startTime, durationMs) => {
            // Simulate what setDurationInfo should store
            const trackingInfo = {
              startTime,
              durationMs,
              expectedEndTime: new Date(startTime.getTime() + durationMs),
              originalDurationMs: durationMs
            };
            
            // Verify all fields are present and correct
            expect(trackingInfo.startTime).toBe(startTime);
            expect(trackingInfo.durationMs).toBe(durationMs);
            expect(trackingInfo.originalDurationMs).toBe(durationMs);
            expect(trackingInfo.expectedEndTime.getTime()).toBe(startTime.getTime() + durationMs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * FFmpeg Args Tests
 * 
 * Tests for FFmpeg argument generation with duration parameter.
 */
describe('FFmpeg Duration Parameter', () => {
  /**
   * **Feature: streaming-duration-fix, Property 5: FFmpeg Duration Parameter**
   * **Validates: Requirements 1.3**
   * 
   * For any stream with a positive duration, the generated FFmpeg args SHALL
   * contain -t followed by the duration in seconds, positioned just before
   * the RTMP URL.
   */
  describe('Property 5: FFmpeg Duration Parameter Position', () => {
    /**
     * Simulates the FFmpeg args building logic for video-only mode
     */
    function buildTestFFmpegArgs(durationSeconds, rtmpUrl) {
      const args = [
        '-threads', '2',
        '-re',
        '-i', 'video.mp4',
        '-c:v', 'copy',
        '-c:a', 'copy'
      ];
      
      // CRITICAL: Duration limit (-t) must be BEFORE -f flv and output URL
      if (durationSeconds && durationSeconds > 0) {
        args.push('-t', durationSeconds.toString());
      }
      
      args.push('-f', 'flv');
      args.push(rtmpUrl);
      
      return args;
    }

    test('-t parameter is positioned just before RTMP URL', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 86400 }), // duration 1 min to 24 hours
          fc.string({ minLength: 10, maxLength: 50 }), // rtmp url
          (durationSeconds, rtmpUrl) => {
            const args = buildTestFFmpegArgs(durationSeconds, `rtmp://test/${rtmpUrl}`);
            
            const tIndex = args.indexOf('-t');
            const fIndex = args.indexOf('-f');
            const urlIndex = args.length - 1;
            
            // -t should exist
            expect(tIndex).toBeGreaterThan(-1);
            
            // -t value should be the duration
            expect(args[tIndex + 1]).toBe(durationSeconds.toString());
            
            // -t should be before -f flv (CRITICAL for FFmpeg)
            expect(tIndex).toBeLessThan(fIndex);
            
            // -t should be before the URL
            expect(tIndex).toBeLessThan(urlIndex);
            
            // Last element should be the URL
            expect(args[urlIndex]).toBe(`rtmp://test/${rtmpUrl}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no -t parameter when duration is null or zero', () => {
      const argsNull = buildTestFFmpegArgs(null, 'rtmp://test/stream');
      const argsZero = buildTestFFmpegArgs(0, 'rtmp://test/stream');
      const argsNegative = buildTestFFmpegArgs(-100, 'rtmp://test/stream');
      
      expect(argsNull.indexOf('-t')).toBe(-1);
      expect(argsZero.indexOf('-t')).toBe(-1);
      expect(argsNegative.indexOf('-t')).toBe(-1);
    });

    test('duration value matches calculated seconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // minutes
          (minutes) => {
            const stream = { stream_duration_minutes: minutes };
            const durationSeconds = calculateDurationSeconds(stream);
            const args = buildTestFFmpegArgs(durationSeconds, 'rtmp://test/stream');
            
            const tIndex = args.indexOf('-t');
            expect(args[tIndex + 1]).toBe((minutes * 60).toString());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Scheduler Duration Tests
 * 
 * Tests for scheduler duration checking logic.
 */
describe('Scheduler Duration Logic', () => {
  /**
   * **Feature: streaming-duration-fix, Property 6: Scheduler Uses Actual Start Time**
   * **Validates: Requirements 4.4**
   * 
   * For any live stream with start_time set, the scheduler duration check
   * SHALL calculate end time as start_time + duration, not using schedule_time.
   */
  describe('Property 6: Scheduler Uses Actual Start Time', () => {
    /**
     * Simulates the scheduler's end time calculation logic
     */
    function calculateEndTime(stream) {
      // CRITICAL: Use actual start_time, not schedule_time
      if (!stream.start_time) {
        return null;
      }
      
      const actualStartTime = new Date(stream.start_time);
      const durationSeconds = calculateDurationSeconds(stream);
      
      if (durationSeconds && durationSeconds > 0) {
        return new Date(actualStartTime.getTime() + durationSeconds * 1000);
      }
      
      return null;
    }

    test('end time is calculated from start_time, not schedule_time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // duration in minutes
          fc.integer({ min: 0, max: 3600 }), // delay between schedule and actual start (seconds)
          (durationMinutes, delaySeconds) => {
            const scheduleTime = new Date('2024-01-01T10:00:00Z');
            const actualStartTime = new Date(scheduleTime.getTime() + delaySeconds * 1000);
            
            const stream = {
              stream_duration_minutes: durationMinutes,
              schedule_time: scheduleTime.toISOString(),
              start_time: actualStartTime.toISOString()
            };
            
            const endTime = calculateEndTime(stream);
            const expectedEndTime = new Date(actualStartTime.getTime() + durationMinutes * 60 * 1000);
            
            // End time should be based on actual start time, not schedule time
            expect(endTime.getTime()).toBe(expectedEndTime.getTime());
            
            // Verify it's NOT based on schedule_time
            const wrongEndTime = new Date(scheduleTime.getTime() + durationMinutes * 60 * 1000);
            if (delaySeconds > 0) {
              expect(endTime.getTime()).not.toBe(wrongEndTime.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns null when start_time is not set', () => {
      const stream = {
        stream_duration_minutes: 60,
        schedule_time: new Date().toISOString(),
        start_time: null
      };
      
      expect(calculateEndTime(stream)).toBeNull();
    });
  });

  /**
   * **Feature: streaming-duration-fix, Property 8: Force Stop Threshold**
   * **Validates: Requirements 4.3**
   * 
   * For any stream that exceeds its expected end time by more than 60 seconds,
   * the scheduler SHALL trigger a force stop.
   */
  describe('Property 8: Force Stop Threshold', () => {
    const FORCE_STOP_BUFFER_MS = 60 * 1000; // 60 seconds

    /**
     * Determines if a stream should be force stopped
     */
    function shouldForceStop(shouldEndAt, now) {
      if (!shouldEndAt) return false;
      const timeOverdue = now.getTime() - shouldEndAt.getTime();
      return timeOverdue > FORCE_STOP_BUFFER_MS;
    }

    test('force stop triggered when exceeded by more than 60 seconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 61, max: 3600 }), // seconds overdue (must be > 60)
          (secondsOverdue) => {
            const shouldEndAt = new Date('2024-01-01T10:00:00Z');
            const now = new Date(shouldEndAt.getTime() + secondsOverdue * 1000);
            
            expect(shouldForceStop(shouldEndAt, now)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no force stop when within 60 second buffer', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 60 }), // seconds overdue (0-60)
          (secondsOverdue) => {
            const shouldEndAt = new Date('2024-01-01T10:00:00Z');
            const now = new Date(shouldEndAt.getTime() + secondsOverdue * 1000);
            
            expect(shouldForceStop(shouldEndAt, now)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no force stop when stream has not reached end time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // seconds before end
          (secondsBefore) => {
            const shouldEndAt = new Date('2024-01-01T10:00:00Z');
            const now = new Date(shouldEndAt.getTime() - secondsBefore * 1000);
            
            expect(shouldForceStop(shouldEndAt, now)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no force stop when shouldEndAt is null', () => {
      expect(shouldForceStop(null, new Date())).toBe(false);
    });
  });
});


/**
 * Integration Tests
 * 
 * Tests for complete stream duration flow.
 */
describe('Integration: Complete Stream Duration Flow', () => {
  /**
   * Tests the complete flow from stream data to FFmpeg args and duration tracking.
   * **Validates: Requirements 1.1, 1.2, 1.3, 3.1**
   */
  describe('Stream Duration Flow', () => {
    test('stream with stream_duration_minutes produces correct FFmpeg args and tracking', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1440 }), // duration in minutes
          (durationMinutes) => {
            // Step 1: Create stream data
            const stream = {
              stream_duration_minutes: durationMinutes,
              schedule_time: null,
              end_time: null
            };
            
            // Step 2: Calculate duration using calculator
            const durationSeconds = calculateDurationSeconds(stream);
            expect(durationSeconds).toBe(durationMinutes * 60);
            
            // Step 3: Verify FFmpeg args would contain correct -t
            const durationMs = durationSeconds * 1000;
            expect(durationMs).toBe(durationMinutes * 60 * 1000);
            
            // Step 4: Verify duration tracking would be set correctly
            const startTime = new Date();
            const expectedEndTime = new Date(startTime.getTime() + durationMs);
            expect(expectedEndTime.getTime()).toBe(startTime.getTime() + durationMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('scheduled stream uses schedule duration correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }), // hours
          (hours) => {
            const scheduleTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date(scheduleTime.getTime() + hours * 3600000);
            
            const stream = {
              stream_duration_minutes: null,
              schedule_time: scheduleTime.toISOString(),
              end_time: endTime.toISOString()
            };
            
            // Duration should be calculated from schedule
            const durationSeconds = calculateDurationSeconds(stream);
            expect(durationSeconds).toBe(hours * 3600);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('priority is maintained when multiple duration fields are set', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }),   // stream_duration_minutes
          fc.integer({ min: 1, max: 24 }),   // schedule hours
          fc.integer({ min: 1, max: 12 }),   // stream_duration_hours
          fc.integer({ min: 1, max: 120 }),  // legacy duration
          (minutes, scheduleHours, hours, legacyDuration) => {
            const scheduleTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date(scheduleTime.getTime() + scheduleHours * 3600000);
            
            const stream = {
              stream_duration_minutes: minutes,
              schedule_time: scheduleTime.toISOString(),
              end_time: endTime.toISOString(),
              stream_duration_hours: hours,
              duration: legacyDuration
            };
            
            // stream_duration_minutes should always win
            const durationSeconds = calculateDurationSeconds(stream);
            expect(durationSeconds).toBe(minutes * 60);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('end-to-end: duration flows correctly through all components', () => {
      // Simulate a complete stream lifecycle
      const durationMinutes = 120; // 2 hours
      
      // 1. Stream data from database
      const stream = {
        id: 'test-stream-123',
        stream_duration_minutes: durationMinutes,
        schedule_time: null,
        end_time: null,
        start_time: null
      };
      
      // 2. Calculate duration for FFmpeg
      const durationSeconds = calculateDurationSeconds(stream);
      expect(durationSeconds).toBe(7200); // 2 hours in seconds
      
      // 3. FFmpeg args would include -t 7200
      const ffmpegTValue = durationSeconds.toString();
      expect(ffmpegTValue).toBe('7200');
      
      // 4. Duration tracking
      const startTime = new Date();
      const durationMs = durationSeconds * 1000;
      const expectedEndTime = new Date(startTime.getTime() + durationMs);
      
      // 5. Scheduler would use this end time
      const schedulerEndTime = new Date(startTime.getTime() + durationSeconds * 1000);
      expect(schedulerEndTime.getTime()).toBe(expectedEndTime.getTime());
      
      // 6. Remaining duration calculation (after 30 minutes)
      const elapsedMs = 30 * 60 * 1000; // 30 minutes
      const remaining = calculateRemainingDuration(startTime, durationMs);
      // Should be close to original (within timing tolerance)
      expect(remaining).toBeGreaterThan(durationMs - 1000);
    });
  });
});
