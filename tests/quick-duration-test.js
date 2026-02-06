/**
 * Quick test for duration calculator - runs without Jest
 */

const {
  calculateDurationSeconds,
  calculateRemainingDuration,
  minutesToSeconds,
  hoursToSeconds,
  formatDuration
} = require('../utils/durationCalculator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${actual}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (actual < expected) {
        throw new Error(`Expected ${actual} >= ${expected}`);
      }
    }
  };
}

console.log('\n=== Duration Calculator Tests ===\n');

// Test 1: Priority - stream_duration_minutes
test('stream_duration_minutes takes priority', () => {
  const stream = {
    stream_duration_minutes: 60,
    stream_duration_hours: 2,
    duration: 30
  };
  expect(calculateDurationSeconds(stream)).toBe(3600); // 60 * 60
});

// Test 2: Priority - schedule calculation
test('schedule calculation when minutes not set', () => {
  const now = new Date('2024-01-01T10:00:00Z');
  const end = new Date('2024-01-01T12:00:00Z'); // 2 hours later
  const stream = {
    stream_duration_minutes: null,
    schedule_time: now.toISOString(),
    end_time: end.toISOString(),
    stream_duration_hours: 5
  };
  expect(calculateDurationSeconds(stream)).toBe(7200); // 2 hours in seconds
});

// Test 3: Priority - stream_duration_hours
test('stream_duration_hours when schedule not available', () => {
  const stream = {
    stream_duration_minutes: null,
    stream_duration_hours: 3,
    duration: 30
  };
  expect(calculateDurationSeconds(stream)).toBe(10800); // 3 * 3600
});

// Test 4: Priority - legacy duration
test('legacy duration as last resort', () => {
  const stream = {
    stream_duration_minutes: null,
    stream_duration_hours: null,
    duration: 45
  };
  expect(calculateDurationSeconds(stream)).toBe(2700); // 45 * 60
});

// Test 5: Null stream
test('null stream returns null', () => {
  expect(calculateDurationSeconds(null)).toBeNull();
});

// Test 6: Empty stream
test('empty stream returns null', () => {
  expect(calculateDurationSeconds({})).toBeNull();
});

// Test 7: Zero values treated as not set
test('zero values treated as not set', () => {
  const stream = {
    stream_duration_minutes: 0,
    stream_duration_hours: 0,
    duration: 0
  };
  expect(calculateDurationSeconds(stream)).toBeNull();
});

// Test 8: Conversion functions
test('minutesToSeconds conversion', () => {
  expect(minutesToSeconds(60)).toBe(3600);
});

test('hoursToSeconds conversion', () => {
  expect(hoursToSeconds(2)).toBe(7200);
});

// Test 9: formatDuration
test('formatDuration formats correctly', () => {
  expect(formatDuration(3600)).toBe('60.0 minutes (3600 seconds)');
  expect(formatDuration(0)).toBe('not set');
  expect(formatDuration(null)).toBe('not set');
});

// Test 10: Remaining duration
test('remaining duration never negative', () => {
  const startTime = new Date(Date.now() - 7200000); // 2 hours ago
  const totalDuration = 3600000; // 1 hour
  const remaining = calculateRemainingDuration(startTime, totalDuration);
  expect(remaining).toBeGreaterThanOrEqual(0);
});

// Test 11: Invalid remaining duration inputs
test('invalid remaining duration inputs return 0', () => {
  expect(calculateRemainingDuration(null, 60000)).toBe(0);
  expect(calculateRemainingDuration(new Date(), null)).toBe(0);
  expect(calculateRemainingDuration(new Date(), -1000)).toBe(0);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
