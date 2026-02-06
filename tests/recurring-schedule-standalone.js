/**
 * Standalone test runner for Recurring Schedule Property Tests
 * Run with: node tests/recurring-schedule-standalone.js
 */

const fc = require('fast-check');

// Configure fast-check
fc.configureGlobal({
  numRuns: 100,
  verbose: false
});

console.log('Starting Recurring Schedule Property Tests...\n');

// ============================================
// FUNCTIONS TO TEST
// ============================================

function serializeScheduleConfig(scheduleConfig) {
  return JSON.stringify({
    schedule_type: scheduleConfig.schedule_type || 'once',
    recurring_time: scheduleConfig.recurring_time || null,
    schedule_days: scheduleConfig.schedule_days || [],
    recurring_enabled: scheduleConfig.recurring_enabled !== false
  });
}

function deserializeScheduleConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);
    return {
      schedule_type: config.schedule_type || 'once',
      recurring_time: config.recurring_time || null,
      schedule_days: Array.isArray(config.schedule_days) ? config.schedule_days : [],
      recurring_enabled: config.recurring_enabled !== false
    };
  } catch (e) {
    return {
      schedule_type: 'once',
      recurring_time: null,
      schedule_days: [],
      recurring_enabled: true
    };
  }
}

function validateWeeklyDays(days) {
  if (!Array.isArray(days)) return { valid: false, error: 'schedule_days must be an array' };
  if (days.length === 0) return { valid: false, error: 'schedule_days cannot be empty for weekly schedule' };
  for (const day of days) {
    if (typeof day !== 'number' || day < 0 || day > 6 || !Number.isInteger(day)) {
      return { valid: false, error: `Invalid day number: ${day}. Must be integer 0-6` };
    }
  }
  return { valid: true };
}

// ============================================
// ARBITRARIES
// ============================================

const validTimeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

const validDayArb = fc.integer({ min: 0, max: 6 });
const validDaysArrayArb = fc.uniqueArray(validDayArb, { minLength: 1, maxLength: 7 });

const validScheduleConfigArb = fc.oneof(
  fc.record({
    schedule_type: fc.constant('once'),
    recurring_time: fc.constant(null),
    schedule_days: fc.constant([]),
    recurring_enabled: fc.boolean()
  }),
  fc.record({
    schedule_type: fc.constant('daily'),
    recurring_time: validTimeArb,
    schedule_days: fc.constant([]),
    recurring_enabled: fc.boolean()
  }),
  fc.record({
    schedule_type: fc.constant('weekly'),
    recurring_time: validTimeArb,
    schedule_days: validDaysArrayArb,
    recurring_enabled: fc.boolean()
  })
);

const invalidDaysArb = fc.oneof(
  fc.constant([]),
  fc.array(fc.integer({ min: 7, max: 100 }), { minLength: 1 }),
  fc.array(fc.integer({ min: -100, max: -1 }), { minLength: 1 })
);

// ============================================
// RUN TESTS
// ============================================

let passed = 0;
let failed = 0;

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
}

// Property 1: Schedule Serialization Round-Trip
runTest('Property 1: Schedule Serialization Round-Trip', () => {
  fc.assert(
    fc.property(validScheduleConfigArb, (config) => {
      const serialized = serializeScheduleConfig(config);
      const deserialized = deserializeScheduleConfig(serialized);
      
      if (deserialized.schedule_type !== config.schedule_type) {
        throw new Error(`schedule_type mismatch: ${deserialized.schedule_type} !== ${config.schedule_type}`);
      }
      if (deserialized.recurring_time !== config.recurring_time) {
        throw new Error(`recurring_time mismatch`);
      }
      if (JSON.stringify(deserialized.schedule_days) !== JSON.stringify(config.schedule_days)) {
        throw new Error(`schedule_days mismatch`);
      }
      if (deserialized.recurring_enabled !== config.recurring_enabled) {
        throw new Error(`recurring_enabled mismatch`);
      }
      return true;
    })
  );
});

// Property 2: Weekly Schedule Day Validation - Invalid days rejected
runTest('Property 2: Weekly Schedule Day Validation (invalid rejected)', () => {
  fc.assert(
    fc.property(invalidDaysArb, (invalidDays) => {
      const result = validateWeeklyDays(invalidDays);
      if (result.valid !== false) {
        throw new Error(`Should reject invalid days: ${JSON.stringify(invalidDays)}`);
      }
      return true;
    })
  );
});

// Property 2: Weekly Schedule Day Validation - Valid days accepted
runTest('Property 2: Weekly Schedule Day Validation (valid accepted)', () => {
  fc.assert(
    fc.property(validDaysArrayArb, (validDays) => {
      const result = validateWeeklyDays(validDays);
      if (result.valid !== true) {
        throw new Error(`Should accept valid days: ${JSON.stringify(validDays)}`);
      }
      return true;
    })
  );
});

// Property 8: Serialized Fields Completeness
runTest('Property 8: Serialized Fields Completeness', () => {
  fc.assert(
    fc.property(validScheduleConfigArb, (config) => {
      const serialized = serializeScheduleConfig(config);
      const parsed = JSON.parse(serialized);
      
      if (!('schedule_type' in parsed)) throw new Error('Missing schedule_type');
      if (!('recurring_time' in parsed)) throw new Error('Missing recurring_time');
      if (!('schedule_days' in parsed)) throw new Error('Missing schedule_days');
      if (!('recurring_enabled' in parsed)) throw new Error('Missing recurring_enabled');
      return true;
    })
  );
});

// Summary
console.log(`\n========================================`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);
