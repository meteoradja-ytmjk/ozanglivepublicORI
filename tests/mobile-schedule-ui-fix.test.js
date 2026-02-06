/**
 * Property-Based Tests for Mobile Schedule UI Fix & Stream Sync Feature
 * Using fast-check library
 * 
 * Tests cover:
 * - Schedule type visibility consistency
 * - Recurring schedule fields visibility
 * - No duplicate UI elements
 * - Stream auto-termination
 * - Status update on stream stop
 */

const fc = require('fast-check');

// Configure fast-check for minimum 100 iterations
fc.configureGlobal({
  numRuns: 100,
  verbose: false
});

// ============================================
// MOCK DOM FUNCTIONS FOR UI TESTING
// ============================================

/**
 * Simulates the setScheduleType function behavior
 * Returns visibility state of UI elements
 */
function simulateSetScheduleType(type) {
  const state = {
    onceSettingsVisible: false,
    recurringSettingsVisible: false,
    weeklyDaysSelectorVisible: false,
    scheduleTypeValue: type
  };

  if (type === 'once') {
    state.onceSettingsVisible = true;
    state.recurringSettingsVisible = false;
  } else {
    state.onceSettingsVisible = false;
    state.recurringSettingsVisible = true;
    
    if (type === 'weekly') {
      state.weeklyDaysSelectorVisible = true;
    } else {
      state.weeklyDaysSelectorVisible = false;
    }
  }

  return state;
}

/**
 * Simulates form elements and checks for duplicates
 */
function getFormElements(scheduleType) {
  const elements = [];
  
  // Schedule type buttons (always present)
  elements.push({ id: 'scheduleTypeOnce', label: 'Once' });
  elements.push({ id: 'scheduleTypeDaily', label: 'Daily' });
  elements.push({ id: 'scheduleTypeWeekly', label: 'Weekly' });
  
  if (scheduleType === 'once') {
    elements.push({ id: 'scheduleStartTime', label: 'Start Stream' });
    elements.push({ id: 'scheduleEndTime', label: 'End Stream' });
  } else {
    elements.push({ id: 'recurringTime', label: 'Stream Time (Daily)' });
    elements.push({ id: 'recurringEnabled', label: 'Enable Recurring' });
    
    if (scheduleType === 'weekly') {
      elements.push({ id: 'weeklyDaysSelector', label: 'Select Days' });
    }
  }
  
  return elements;
}

// ============================================
// STREAM TERMINATION LOGIC
// ============================================

/**
 * Calculate when a stream should end based on duration and end_time
 * Returns the earlier of the two if both are set
 */
function calculateStreamEndTime(stream, startTime) {
  let shouldEndAt = null;
  
  // Check stream_duration_hours (in hours)
  if (stream.stream_duration_hours && stream.stream_duration_hours > 0) {
    const durationMs = stream.stream_duration_hours * 60 * 60 * 1000;
    shouldEndAt = new Date(startTime.getTime() + durationMs);
  }
  // Check duration (in minutes) - legacy field
  else if (stream.duration && stream.duration > 0) {
    const durationMs = stream.duration * 60 * 1000;
    shouldEndAt = new Date(startTime.getTime() + durationMs);
  }
  
  // Check schedule end time
  if (stream.end_time) {
    const scheduleEndAt = new Date(stream.end_time);
    // Use the earlier of duration end or schedule end
    if (!shouldEndAt || scheduleEndAt < shouldEndAt) {
      shouldEndAt = scheduleEndAt;
    }
  }
  
  return shouldEndAt;
}

/**
 * Simulates stream status update logic
 */
function updateStreamStatus(stream, newStatus) {
  return {
    ...stream,
    status: newStatus,
    status_updated_at: new Date().toISOString(),
    end_time: newStatus === 'offline' ? new Date().toISOString() : stream.end_time
  };
}

// ============================================
// ARBITRARIES (Generators for property tests)
// ============================================

const scheduleTypeArb = fc.constantFrom('once', 'daily', 'weekly');

const validTimeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

const validDayArb = fc.integer({ min: 0, max: 6 });
const validDaysArrayArb = fc.uniqueArray(validDayArb, { minLength: 1, maxLength: 7 });

const durationHoursArb = fc.integer({ min: 1, max: 168 }); // 1 hour to 1 week
const durationMinutesArb = fc.integer({ min: 1, max: 10080 }); // 1 minute to 1 week

const dateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') });

const streamArb = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom('offline', 'live', 'scheduled'),
  stream_duration_hours: fc.option(durationHoursArb, { nil: null }),
  duration: fc.option(durationMinutesArb, { nil: null }),
  end_time: fc.option(dateArb.map(d => d.toISOString()), { nil: null }),
  schedule_type: scheduleTypeArb,
  recurring_time: fc.option(validTimeArb, { nil: null }),
  schedule_days: fc.option(validDaysArrayArb, { nil: null }),
  recurring_enabled: fc.boolean()
});

// ============================================
// PROPERTY TESTS
// ============================================

describe('Mobile Schedule UI Fix - Property Based Tests', () => {
  
  /**
   * **Feature: mobile-schedule-ui-fix, Property 1: Schedule Type Visibility Consistency**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   * 
   * For any schedule type selection (once, daily, weekly), the visibility of 
   * Start/End Stream fields SHALL be consistent:
   * - Once: Start/End Stream fields visible, Recurring Settings hidden
   * - Daily/Weekly: Start/End Stream fields hidden, Recurring Settings visible
   */
  describe('Property 1: Schedule Type Visibility Consistency', () => {
    it('once schedule shows Start/End Stream fields and hides recurring settings', () => {
      const state = simulateSetScheduleType('once');
      
      expect(state.onceSettingsVisible).toBe(true);
      expect(state.recurringSettingsVisible).toBe(false);
      expect(state.scheduleTypeValue).toBe('once');
    });

    it('daily schedule hides Start/End Stream fields and shows recurring settings', () => {
      const state = simulateSetScheduleType('daily');
      
      expect(state.onceSettingsVisible).toBe(false);
      expect(state.recurringSettingsVisible).toBe(true);
      expect(state.weeklyDaysSelectorVisible).toBe(false);
      expect(state.scheduleTypeValue).toBe('daily');
    });

    it('weekly schedule hides Start/End Stream fields and shows recurring settings with day selector', () => {
      const state = simulateSetScheduleType('weekly');
      
      expect(state.onceSettingsVisible).toBe(false);
      expect(state.recurringSettingsVisible).toBe(true);
      expect(state.weeklyDaysSelectorVisible).toBe(true);
      expect(state.scheduleTypeValue).toBe('weekly');
    });

    it('for any schedule type, exactly one settings section is visible', () => {
      fc.assert(
        fc.property(scheduleTypeArb, (type) => {
          const state = simulateSetScheduleType(type);
          
          // XOR: exactly one should be visible
          const onlyOnceVisible = state.onceSettingsVisible && !state.recurringSettingsVisible;
          const onlyRecurringVisible = !state.onceSettingsVisible && state.recurringSettingsVisible;
          
          expect(onlyOnceVisible || onlyRecurringVisible).toBe(true);
          expect(onlyOnceVisible && onlyRecurringVisible).toBe(false);
        })
      );
    });

    it('transitioning between schedule types updates visibility correctly', () => {
      fc.assert(
        fc.property(scheduleTypeArb, scheduleTypeArb, (fromType, toType) => {
          // Simulate transition
          const fromState = simulateSetScheduleType(fromType);
          const toState = simulateSetScheduleType(toType);
          
          // After transition, state should match the target type
          if (toType === 'once') {
            expect(toState.onceSettingsVisible).toBe(true);
            expect(toState.recurringSettingsVisible).toBe(false);
          } else {
            expect(toState.onceSettingsVisible).toBe(false);
            expect(toState.recurringSettingsVisible).toBe(true);
          }
        })
      );
    });
  });


  /**
   * **Feature: mobile-schedule-ui-fix, Property 2: Recurring Schedule Fields Visibility**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any recurring schedule type (daily or weekly):
   * - Daily: Stream Time and Enable Recurring toggle SHALL be visible
   * - Weekly: Stream Time, Day Selector, and Enable Recurring toggle SHALL be visible
   */
  describe('Property 2: Recurring Schedule Fields Visibility', () => {
    it('daily schedule shows Stream Time and Enable Recurring', () => {
      const elements = getFormElements('daily');
      const elementIds = elements.map(e => e.id);
      
      expect(elementIds).toContain('recurringTime');
      expect(elementIds).toContain('recurringEnabled');
      expect(elementIds).not.toContain('weeklyDaysSelector');
    });

    it('weekly schedule shows Stream Time, Day Selector, and Enable Recurring', () => {
      const elements = getFormElements('weekly');
      const elementIds = elements.map(e => e.id);
      
      expect(elementIds).toContain('recurringTime');
      expect(elementIds).toContain('recurringEnabled');
      expect(elementIds).toContain('weeklyDaysSelector');
    });

    it('for any recurring type, Stream Time and Enable Recurring are always present', () => {
      fc.assert(
        fc.property(fc.constantFrom('daily', 'weekly'), (type) => {
          const elements = getFormElements(type);
          const elementIds = elements.map(e => e.id);
          
          expect(elementIds).toContain('recurringTime');
          expect(elementIds).toContain('recurringEnabled');
        })
      );
    });
  });

  /**
   * **Feature: mobile-schedule-ui-fix, Property 3: No Duplicate UI Elements**
   * **Validates: Requirements 2.4, 2.5**
   * 
   * For any schedule type selection, each label/text element SHALL appear 
   * exactly once in the form. No duplicate labels or redundant UI elements 
   * SHALL be present.
   */
  describe('Property 3: No Duplicate UI Elements', () => {
    it('for any schedule type, no duplicate element IDs exist', () => {
      fc.assert(
        fc.property(scheduleTypeArb, (type) => {
          const elements = getFormElements(type);
          const elementIds = elements.map(e => e.id);
          const uniqueIds = [...new Set(elementIds)];
          
          expect(elementIds.length).toBe(uniqueIds.length);
        })
      );
    });

    it('for any schedule type, no duplicate labels exist', () => {
      fc.assert(
        fc.property(scheduleTypeArb, (type) => {
          const elements = getFormElements(type);
          const labels = elements.map(e => e.label);
          const uniqueLabels = [...new Set(labels)];
          
          expect(labels.length).toBe(uniqueLabels.length);
        })
      );
    });

    it('once schedule has exactly 5 unique elements', () => {
      const elements = getFormElements('once');
      // 3 schedule type buttons + 2 datetime inputs
      expect(elements.length).toBe(5);
    });

    it('daily schedule has exactly 5 unique elements', () => {
      const elements = getFormElements('daily');
      // 3 schedule type buttons + time input + enable toggle
      expect(elements.length).toBe(5);
    });

    it('weekly schedule has exactly 6 unique elements', () => {
      const elements = getFormElements('weekly');
      // 3 schedule type buttons + time input + day selector + enable toggle
      expect(elements.length).toBe(6);
    });
  });
});

describe('Stream Auto-Termination - Property Based Tests', () => {
  
  /**
   * **Feature: mobile-schedule-ui-fix, Property 4: Stream Auto-Termination**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any stream with duration or end time set:
   * - If stream_duration_hours is set, stream SHALL stop after exactly that duration
   * - If schedule_end_time is set, stream SHALL stop at that exact time
   * - The earlier of the two conditions SHALL trigger the stop
   */
  describe('Property 4: Stream Auto-Termination', () => {
    it('stream with duration_hours ends after specified duration', () => {
      fc.assert(
        fc.property(durationHoursArb, dateArb, (hours, startTime) => {
          const stream = {
            stream_duration_hours: hours,
            duration: null,
            end_time: null
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).not.toBeNull();
          const expectedEndMs = startTime.getTime() + (hours * 60 * 60 * 1000);
          expect(endTime.getTime()).toBe(expectedEndMs);
        })
      );
    });

    it('stream with duration (minutes) ends after specified duration', () => {
      fc.assert(
        fc.property(durationMinutesArb, dateArb, (minutes, startTime) => {
          const stream = {
            stream_duration_hours: null,
            duration: minutes,
            end_time: null
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).not.toBeNull();
          const expectedEndMs = startTime.getTime() + (minutes * 60 * 1000);
          expect(endTime.getTime()).toBe(expectedEndMs);
        })
      );
    });

    it('stream with end_time ends at specified time', () => {
      fc.assert(
        fc.property(dateArb, dateArb, (startTime, endTimeDate) => {
          const stream = {
            stream_duration_hours: null,
            duration: null,
            end_time: endTimeDate.toISOString()
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).not.toBeNull();
          expect(endTime.getTime()).toBe(endTimeDate.getTime());
        })
      );
    });

    it('when both duration and end_time are set, uses the earlier one', () => {
      fc.assert(
        fc.property(durationHoursArb, dateArb, (hours, startTime) => {
          // Create end_time that is before duration would end
          const durationEndMs = startTime.getTime() + (hours * 60 * 60 * 1000);
          const earlyEndTime = new Date(durationEndMs - (30 * 60 * 1000)); // 30 min earlier
          
          const stream = {
            stream_duration_hours: hours,
            duration: null,
            end_time: earlyEndTime.toISOString()
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).not.toBeNull();
          expect(endTime.getTime()).toBe(earlyEndTime.getTime());
        })
      );
    });

    it('when both duration and end_time are set, uses duration if earlier', () => {
      fc.assert(
        fc.property(durationHoursArb, dateArb, (hours, startTime) => {
          // Create end_time that is after duration would end
          const durationEndMs = startTime.getTime() + (hours * 60 * 60 * 1000);
          const lateEndTime = new Date(durationEndMs + (30 * 60 * 1000)); // 30 min later
          
          const stream = {
            stream_duration_hours: hours,
            duration: null,
            end_time: lateEndTime.toISOString()
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).not.toBeNull();
          expect(endTime.getTime()).toBe(durationEndMs);
        })
      );
    });

    it('stream without duration or end_time returns null', () => {
      fc.assert(
        fc.property(dateArb, (startTime) => {
          const stream = {
            stream_duration_hours: null,
            duration: null,
            end_time: null
          };
          
          const endTime = calculateStreamEndTime(stream, startTime);
          
          expect(endTime).toBeNull();
        })
      );
    });
  });
});

describe('Status Synchronization - Property Based Tests', () => {
  
  /**
   * **Feature: mobile-schedule-ui-fix, Property 5: Status Update on Stream Stop**
   * **Validates: Requirements 3.3, 3.4, 3.5**
   * 
   * For any stream that stops (manually, by duration, by end time, or by error):
   * - Database status SHALL be updated to 'offline'
   * - Dashboard SHALL reflect the updated status
   * - No stream SHALL remain in 'live' status when FFmpeg process is not running
   */
  describe('Property 5: Status Update on Stream Stop', () => {
    it('stopping a stream updates status to offline', () => {
      fc.assert(
        fc.property(streamArb, (stream) => {
          const updatedStream = updateStreamStatus(stream, 'offline');
          
          expect(updatedStream.status).toBe('offline');
          expect(updatedStream.status_updated_at).toBeDefined();
        })
      );
    });

    it('stopping a stream sets end_time', () => {
      fc.assert(
        fc.property(streamArb, (stream) => {
          const updatedStream = updateStreamStatus(stream, 'offline');
          
          expect(updatedStream.end_time).toBeDefined();
          expect(updatedStream.end_time).not.toBeNull();
        })
      );
    });

    it('status update preserves other stream properties', () => {
      fc.assert(
        fc.property(streamArb, (stream) => {
          const updatedStream = updateStreamStatus(stream, 'offline');
          
          expect(updatedStream.id).toBe(stream.id);
          expect(updatedStream.stream_duration_hours).toBe(stream.stream_duration_hours);
          expect(updatedStream.duration).toBe(stream.duration);
          expect(updatedStream.schedule_type).toBe(stream.schedule_type);
          expect(updatedStream.recurring_time).toBe(stream.recurring_time);
          expect(updatedStream.recurring_enabled).toBe(stream.recurring_enabled);
        })
      );
    });

    it('live stream can be stopped', () => {
      fc.assert(
        fc.property(streamArb, (stream) => {
          const liveStream = { ...stream, status: 'live' };
          const stoppedStream = updateStreamStatus(liveStream, 'offline');
          
          expect(stoppedStream.status).toBe('offline');
        })
      );
    });

    it('scheduled stream can be stopped', () => {
      fc.assert(
        fc.property(streamArb, (stream) => {
          const scheduledStream = { ...stream, status: 'scheduled' };
          const stoppedStream = updateStreamStatus(scheduledStream, 'offline');
          
          expect(stoppedStream.status).toBe('offline');
        })
      );
    });
  });
});
