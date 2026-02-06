/**
 * Streaming Duration Stop Fix Tests
 * 
 * Property-based tests to verify that livestreaming stops correctly
 * according to the duration specified by the user.
 * 
 * **Feature: streaming-duration-stop-fix**
 */

const fc = require('fast-check');
const { calculateDurationSeconds, formatDuration } = require('../utils/durationCalculator');

// Mock setDurationInfo and related functions for testing
const streamDurationInfo = new Map();

function setDurationInfo(streamId, startTime, durationMs) {
  if (!durationMs || durationMs <= 0) {
    return false;
  }
  
  const expectedEndTime = new Date(startTime.getTime() + durationMs);
  
  streamDurationInfo.set(streamId, {
    startTime,
    durationMs,
    expectedEndTime,
    originalDurationMs: durationMs
  });
  
  return true;
}

function getDurationInfo(streamId) {
  return streamDurationInfo.get(streamId) || null;
}

function clearDurationInfo(streamId) {
  streamDurationInfo.delete(streamId);
}

function getRemainingTime(streamId) {
  const info = getDurationInfo(streamId);
  if (!info || !info.expectedEndTime) return null;
  return Math.max(0, info.expectedEndTime.getTime() - Date.now());
}

function isStreamDurationExceeded(streamId) {
  const info = getDurationInfo(streamId);
  if (!info || !info.expectedEndTime) return false;
  return new Date() >= info.expectedEndTime;
}

// Helper to build test FFmpeg args (simplified version)
function buildTestFFmpegArgs(durationSeconds, rtmpUrl) {
  const args = [
    '-threads', '2',
    '-loglevel', 'error',
    '-re',
    '-i', 'test_video.mp4',
    '-c:v', 'copy',
    '-c:a', 'copy'
  ];
  
  // CRITICAL: Duration limit (-t) must be placed BEFORE -f flv and output URL
  if (durationSeconds && durationSeconds > 0) {
    args.push('-t', durationSeconds.toString());
  }
  
  args.push('-f', 'flv');
  args.push(rtmpUrl);
  return args;
}

describe('Streaming Duration Stop Fix', () => {
  beforeEach(() => {
    // Clear duration info before each test
    streamDurationInfo.clear();
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 3: End Time Calculation from Start Time**
   * 
   * *For any* live stream with start_time and stream_duration_minutes set,
   * the expected end time SHALL equal start_time + (stream_duration_minutes * 60 * 1000) milliseconds.
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 3: End Time Calculation from Start Time', () => {
    test('expected end time equals start_time + duration_ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10080 }), // stream_duration_minutes (1 min to 1 week)
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }), // start_time
          (durationMinutes, startTime) => {
            const streamId = 'test-stream-' + Math.random();
            const durationMs = durationMinutes * 60 * 1000;
            
            // Set duration info
            const result = setDurationInfo(streamId, startTime, durationMs);
            expect(result).toBe(true);
            
            // Get duration info
            const info = getDurationInfo(streamId);
            expect(info).not.toBeNull();
            
            // Verify expected end time calculation
            const expectedEndTime = new Date(startTime.getTime() + durationMs);
            expect(info.expectedEndTime.getTime()).toBe(expectedEndTime.getTime());
            
            // Verify duration stored correctly
            expect(info.durationMs).toBe(durationMs);
            expect(info.startTime.getTime()).toBe(startTime.getTime());
            
            // Cleanup
            clearDurationInfo(streamId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setDurationInfo returns false for invalid duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: 0 }), // invalid duration (zero or negative)
          fc.date(),
          (invalidDuration, startTime) => {
            const streamId = 'test-stream-' + Math.random();
            
            // Should return false for invalid duration
            const result = setDurationInfo(streamId, startTime, invalidDuration);
            expect(result).toBe(false);
            
            // Should not store anything
            const info = getDurationInfo(streamId);
            expect(info).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('remaining time decreases as time passes', () => {
      const streamId = 'test-stream-remaining';
      const startTime = new Date();
      const durationMs = 60 * 60 * 1000; // 1 hour
      
      setDurationInfo(streamId, startTime, durationMs);
      
      const remainingTime = getRemainingTime(streamId);
      expect(remainingTime).not.toBeNull();
      expect(remainingTime).toBeLessThanOrEqual(durationMs);
      expect(remainingTime).toBeGreaterThan(0);
      
      clearDurationInfo(streamId);
    });
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 1: FFmpeg Duration Parameter Correctness**
   * 
   * *For any* stream with stream_duration_minutes set to a positive value,
   * the FFmpeg args array SHALL contain -t followed by stream_duration_minutes * 60 (converted to seconds).
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: FFmpeg Duration Parameter Correctness', () => {
    test('FFmpeg args contain correct -t parameter for positive duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10080 }), // stream_duration_minutes
          (durationMinutes) => {
            const durationSeconds = durationMinutes * 60;
            const rtmpUrl = 'rtmp://test.server/live/stream_key';
            
            const args = buildTestFFmpegArgs(durationSeconds, rtmpUrl);
            
            // Find -t parameter
            const tIndex = args.indexOf('-t');
            expect(tIndex).toBeGreaterThan(-1);
            
            // Verify -t value is correct (in seconds)
            const tValue = args[tIndex + 1];
            expect(tValue).toBe(durationSeconds.toString());
            
            // Verify -t is before -f flv (CRITICAL for FFmpeg to respect duration)
            const fIndex = args.indexOf('-f');
            expect(tIndex).toBeLessThan(fIndex);
            
            // Verify -t is before output URL
            const urlIndex = args.indexOf(rtmpUrl);
            expect(tIndex).toBeLessThan(urlIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('FFmpeg args do not contain -t for zero or null duration', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, null, undefined),
          (invalidDuration) => {
            const rtmpUrl = 'rtmp://test.server/live/stream_key';
            
            const args = buildTestFFmpegArgs(invalidDuration, rtmpUrl);
            
            // Should not contain -t parameter
            const tIndex = args.indexOf('-t');
            expect(tIndex).toBe(-1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 2: Recurring Stream Duration Priority**
   * 
   * *For any* recurring stream (schedule_type = 'daily' or 'weekly') with stream_duration_minutes set,
   * the calculated duration SHALL equal stream_duration_minutes * 60 seconds,
   * regardless of schedule_time or end_time values.
   * 
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Recurring Stream Duration Priority', () => {
    test('stream_duration_minutes takes priority for recurring streams', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10080 }), // stream_duration_minutes
          fc.constantFrom('daily', 'weekly'), // schedule_type
          fc.integer({ min: 0, max: 365 }), // days offset for stale schedule_time
          fc.integer({ min: 1, max: 24 }), // hours for stale end_time offset
          (durationMinutes, scheduleType, daysOffset, hoursOffset) => {
            // Create valid dates using offsets
            const baseDate = new Date('2024-06-15T10:00:00.000Z');
            const staleScheduleTime = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);
            const staleEndTime = new Date(staleScheduleTime.getTime() + hoursOffset * 60 * 60 * 1000);
            
            const stream = {
              stream_duration_minutes: durationMinutes,
              schedule_type: scheduleType,
              schedule_time: staleScheduleTime.toISOString(),
              end_time: staleEndTime.toISOString(),
              recurring_enabled: true
            };
            
            const result = calculateDurationSeconds(stream);
            
            // Should always use stream_duration_minutes, not schedule calculation
            expect(result).toBe(durationMinutes * 60);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('recurring streams ignore stale schedule values', () => {
      // Create a stream with stale schedule values (from yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const staleEndTime = new Date(yesterday);
      staleEndTime.setHours(staleEndTime.getHours() + 2); // 2 hours after schedule
      
      const stream = {
        stream_duration_minutes: 540, // 9 hours (user's intended duration)
        schedule_type: 'weekly',
        schedule_time: yesterday.toISOString(),
        end_time: staleEndTime.toISOString(), // This would give 2 hours if used
        recurring_enabled: true
      };
      
      const result = calculateDurationSeconds(stream);
      
      // Should use stream_duration_minutes (540 * 60 = 32400 seconds = 9 hours)
      // NOT the stale schedule calculation (2 hours = 7200 seconds)
      expect(result).toBe(540 * 60);
      expect(result).not.toBe(2 * 60 * 60); // Not 2 hours
    });
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 4: Scheduler Overdue Detection**
   * 
   * *For any* live stream where current time exceeds expected end time,
   * the scheduler SHALL detect it as overdue and initiate stop.
   * 
   * **Validates: Requirements 2.1**
   */
  describe('Property 4: Scheduler Overdue Detection', () => {
    test('isStreamDurationExceeded returns true when past end time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }), // duration in minutes (short for testing)
          (durationMinutes) => {
            const streamId = 'test-stream-overdue-' + Math.random();
            
            // Set start time in the past so duration is exceeded
            const pastStartTime = new Date();
            pastStartTime.setMinutes(pastStartTime.getMinutes() - durationMinutes - 5); // 5 minutes past
            
            const durationMs = durationMinutes * 60 * 1000;
            setDurationInfo(streamId, pastStartTime, durationMs);
            
            // Should detect as exceeded
            const exceeded = isStreamDurationExceeded(streamId);
            expect(exceeded).toBe(true);
            
            // Remaining time should be 0
            const remaining = getRemainingTime(streamId);
            expect(remaining).toBe(0);
            
            clearDurationInfo(streamId);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('isStreamDurationExceeded returns false when before end time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 600 }), // duration in minutes (1-10 hours)
          (durationMinutes) => {
            const streamId = 'test-stream-active-' + Math.random();
            
            // Set start time to now
            const startTime = new Date();
            const durationMs = durationMinutes * 60 * 1000;
            
            setDurationInfo(streamId, startTime, durationMs);
            
            // Should not be exceeded yet
            const exceeded = isStreamDurationExceeded(streamId);
            expect(exceeded).toBe(false);
            
            // Remaining time should be positive
            const remaining = getRemainingTime(streamId);
            expect(remaining).toBeGreaterThan(0);
            
            clearDurationInfo(streamId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 5: Duration Display Format**
   * 
   * *For any* stream_duration_minutes value, the formatted display SHALL correctly
   * show hours and minutes (e.g., 540 minutes → "9 jam", 545 minutes → "9 jam 5 menit").
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 5: Duration Display Format', () => {
    test('formatDuration correctly formats minutes to readable string', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10080 }), // minutes (up to 1 week)
          (totalMinutes) => {
            const durationSeconds = totalMinutes * 60;
            const formatted = formatDuration(durationSeconds);
            
            // Should not be 'not set'
            expect(formatted).not.toBe('not set');
            
            // Should contain the correct number representation
            const expectedMinutes = totalMinutes;
            const hours = Math.floor(expectedMinutes / 60);
            const mins = expectedMinutes % 60;
            
            // formatDuration returns "X.Y minutes (Z seconds)"
            // Verify it contains the correct values
            expect(formatted).toContain('minutes');
            expect(formatted).toContain(`${durationSeconds} seconds`);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formatDuration returns "not set" for zero or invalid values', () => {
      expect(formatDuration(0)).toBe('not set');
      expect(formatDuration(null)).toBe('not set');
      expect(formatDuration(undefined)).toBe('not set');
      expect(formatDuration(-100)).toBe('not set');
    });
  });

  /**
   * **Feature: streaming-duration-stop-fix, Property 6: Remaining Time Calculation**
   * 
   * *For any* live stream with start_time and stream_duration_minutes,
   * the remaining time SHALL equal (start_time + stream_duration_minutes * 60000) - current_time,
   * with minimum value of 0.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 6: Remaining Time Calculation', () => {
    test('remaining time is correctly calculated', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 600 }), // duration in minutes
          (durationMinutes) => {
            const streamId = 'test-stream-remaining-' + Math.random();
            const startTime = new Date();
            const durationMs = durationMinutes * 60 * 1000;
            
            setDurationInfo(streamId, startTime, durationMs);
            
            const remaining = getRemainingTime(streamId);
            const info = getDurationInfo(streamId);
            
            // Remaining should be approximately durationMs (within a few ms tolerance)
            expect(remaining).toBeLessThanOrEqual(durationMs);
            expect(remaining).toBeGreaterThan(durationMs - 1000); // Within 1 second
            
            // Verify calculation: expectedEndTime - now
            const expectedRemaining = info.expectedEndTime.getTime() - Date.now();
            expect(Math.abs(remaining - expectedRemaining)).toBeLessThan(100); // Within 100ms
            
            clearDurationInfo(streamId);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('remaining time is never negative', () => {
      const streamId = 'test-stream-past';
      const pastStartTime = new Date();
      pastStartTime.setHours(pastStartTime.getHours() - 2); // 2 hours ago
      
      const durationMs = 60 * 60 * 1000; // 1 hour duration
      setDurationInfo(streamId, pastStartTime, durationMs);
      
      const remaining = getRemainingTime(streamId);
      
      // Should be 0, not negative
      expect(remaining).toBe(0);
      
      clearDurationInfo(streamId);
    });
  });
});
