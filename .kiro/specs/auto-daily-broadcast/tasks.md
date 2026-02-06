# Implementation Plan

- [x] 1. Enhance RecurringUtils for robust schedule calculation

  - [x] 1.1 Fix calculateNextRun to handle edge cases (midnight, timezone)


    - Ensure next_run_at is always in the future
    - Handle case when current time equals recurring_time

    - _Requirements: 1.1, 3.2, 5.3_
  - [x] 1.2 Write property test for next run calculation


    - **Property 1: Next run calculation correctness**


    - **Validates: Requirements 1.1, 3.2, 5.3**
  - [x] 1.3 Enhance replaceTitlePlaceholders to support more formats

    - Support {date}, {time}, {day}, {month}, {year} placeholders
    - Use consistent date format DD/MM/YYYY

    - _Requirements: 4.1, 4.2_


  - [ ] 1.4 Write property test for placeholder replacement
    - **Property 4: Placeholder replacement correctness**
    - **Validates: Requirements 4.1, 4.2**


- [x] 2. Enhance ScheduleService execution logic

  - [ ] 2.1 Fix shouldExecute to properly check schedule timing
    - Compare hours and minutes correctly
    - Check hasRunToday before executing

    - Handle weekly pattern day matching
    - _Requirements: 1.2, 2.3_

  - [x] 2.2 Write property test for schedule execution timing


    - **Property 2: Schedule execution timing**
    - **Validates: Requirements 1.2, 2.3**

  - [ ] 2.3 Fix hasRunToday to prevent duplicate broadcasts
    - Compare dates correctly (same calendar day)

    - Handle timezone considerations
    - _Requirements: 2.3_
  - [x] 2.4 Write property test for duplicate prevention

    - **Property 3: Duplicate prevention**
    - **Validates: Requirements 2.3**


- [x] 3. Enhance executeTemplate for reliable broadcast creation

  - [x] 3.1 Ensure all template settings are passed to createBroadcast


    - Include stream_id, tags, category_id, privacy_status
    - Calculate scheduledStartTime as 10 minutes from now

    - _Requirements: 1.4, 4.3, 4.4_
  - [x] 3.2 Write property test for template settings preservation

    - **Property 5: Template settings preservation**
    - **Validates: Requirements 1.4, 4.3, 4.4**
  - [x] 3.3 Fix updateLastRun to correctly calculate next day's run

    - Set last_run_at to current timestamp

    - Calculate next_run_at for tomorrow at recurring_time
    - _Requirements: 1.3_
  - [x] 3.4 Write property test for last run update

    - **Property 7: Last run update correctness**
    - **Validates: Requirements 1.3**

- [x] 4. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.



- [ ] 5. Enhance toggle recurring functionality
  - [x] 5.1 Fix toggleRecurring to preserve configuration when disabling

    - Only update recurring_enabled field when toggling off
    - Preserve recurring_pattern, recurring_time, recurring_days
    - _Requirements: 5.2_


  - [ ] 5.2 Write property test for toggle preserves configuration
    - **Property 6: Toggle preserves configuration**
    - **Validates: Requirements 5.2**
  - [ ] 5.3 Update toggle on to recalculate next_run_at
    - Call calculateNextRun when enabling
    - Update next_run_at in database
    - _Requirements: 5.3_

- [ ] 6. Add missed schedule handling
  - [ ] 6.1 Add isScheduleMissed utility function
    - Check if next_run_at is in the past
    - Return true if missed within same day
    - _Requirements: 2.2_
  - [ ] 6.2 Update checkSchedules to handle missed schedules
    - On each check, also look for missed schedules
    - Execute immediately if missed today
    - Recalculate next_run_at after execution
    - _Requirements: 2.2_

- [ ] 7. Improve server startup initialization
  - [ ] 7.1 Enhance init to check for missed schedules on startup
    - Load all recurring templates
    - Check each for missed schedules
    - Execute missed ones immediately
    - _Requirements: 2.1, 2.2_
  - [ ] 7.2 Add logging for initialization status
    - Log number of templates loaded
    - Log any missed schedules being executed
    - _Requirements: 3.4_

- [ ] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

