# Implementation Plan

- [x] 1. Fix frontend saveScheduleEdit function to send correct field names

  - [x] 1.1 Update saveScheduleEdit() in schedule.ejs to use correct API field names
    - Change `schedule_time` to `scheduleStartTime`
    - Change `end_time` to `scheduleEndTime`
    - Change `stream_duration_minutes` to `streamDurationHours` and `streamDurationMinutes`
    - Change `recurring_time` to `recurringTime`
    - Change `recurring_enabled` to `recurringEnabled`
    - Change `schedule_days` to `scheduleDays`

    - _Requirements: 1.2_

  - [x] 1.2 Write property test for duration calculation
    - **Property 1: Duration calculation consistency**

    - **Validates: Requirements 1.3, 3.1**

  - [x] 1.3 Write property test for duration display round-trip
    - **Property 2: Duration display round-trip**
    - **Validates: Requirements 3.3**

- [x] 2. Ensure datetime conversion is correct

  - [x] 2.1 Verify formatDateTimeLocal function handles all ISO strings correctly
    - Ensure proper conversion from UTC ISO string to local datetime-local format
    - Handle edge cases like midnight, end of month, etc.

    - _Requirements: 1.1, 4.1_

  - [x] 2.2 Ensure datetime-local to ISO conversion is correct when saving
    - Verify parseLocalDateTime function in API works correctly
    - Ensure saved ISO string represents the correct local time

    - _Requirements: 4.2_

  - [x] 2.3 Write property test for ISO to local datetime conversion
    - **Property 3: ISO to local datetime conversion**
    - **Validates: Requirements 1.1, 4.1**

  - [x] 2.4 Write property test for local to ISO round-trip
    - **Property 4: Local to ISO conversion round-trip**
    - **Validates: Requirements 1.4, 4.2**

- [x] 3. Checkpoint - Make sure all tests are passing
  - All 19 tests passing ✓

- [x] 4. Fix recurring schedule handling

  - [x] 4.1 Ensure recurring_time is saved in correct HH:MM format
    - Verify time input sends correct format
    - _Requirements: 2.1_

  - [x] 4.2 Ensure schedule_days is saved correctly for weekly schedules
    - Verify JSON array is properly serialized and deserialized
    - _Requirements: 2.2_

  - [x] 4.3 Ensure recurring_enabled toggle works correctly
    - Verify boolean is properly converted to 1/0 for database
    - _Requirements: 2.3_

  - [x] 4.4 Write property test for recurring time format validation
    - **Property 5: Recurring time format validation**
    - **Validates: Requirements 2.1**

  - [x] 4.5 Write property test for weekly schedule days persistence
    - **Property 6: Weekly schedule days persistence**
    - **Validates: Requirements 2.2**

- [x] 5. Verify scheduler timing accuracy

  - [x] 5.1 Review shouldTriggerDaily and shouldTriggerWeekly functions
    - Ensure they use WIB timezone consistently
    - Verify trigger window is 0-5 minutes after scheduled time
    - _Requirements: 2.4, 4.3_

  - [x] 5.2 Write property test for scheduler trigger timing
    - **Property 7: Scheduler trigger timing accuracy**
    - **Validates: Requirements 2.4**

  - [x] 5.3 Write property test for WIB timezone consistency
    - **Property 8: WIB timezone consistency**
    - **Validates: Requirements 4.3**

- [x] 6. Final Checkpoint - Make sure all tests are passing
  - All 19 tests passing ✓
  - Test coverage includes:
    - Duration calculation consistency
    - Duration display round-trip
    - ISO to local datetime conversion
    - Local to ISO round-trip
    - Recurring time format validation
    - Weekly schedule days persistence
    - Scheduler trigger timing accuracy
    - WIB timezone consistency
