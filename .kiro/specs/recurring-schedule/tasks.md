# Implementation Plan

- [x] 1. Setup database schema and model extensions




  - [ ] 1.1 Add recurring schedule columns to streams table
    - Add migration for schedule_type, schedule_days, recurring_time, recurring_enabled columns


    - Update database.js with new column definitions
    - _Requirements: 1.4, 6.1_
  - [x] 1.2 Extend Stream model with recurring schedule methods


    - Add findRecurringSchedules() method to find schedules by type and time




    - Add updateRecurringEnabled() method to enable/disable schedules
    - Add getNextScheduledTime() helper method
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 1.3 Write property test for schedule serialization round-trip

    - **Property 1: Schedule Serialization Round-Trip**
    - **Validates: Requirements 6.1, 6.2**


- [x] 2. Implement schedule validation logic




  - [ ] 2.1 Create schedule validation utilities
    - Create utils/scheduleValidator.js with validation functions




    - Implement validateScheduleConfig() for all schedule types
    - Implement validateWeeklyDays() for day array validation

    - Implement validateTimeFormat() for HH:MM validation
    - _Requirements: 1.5, 6.4_
  - [x] 2.2 Write property test for weekly schedule day validation

    - **Property 2: Weekly Schedule Day Validation**
    - **Validates: Requirements 1.5**

  - [ ] 2.3 Write property test for serialized fields completeness
    - **Property 8: Serialized Fields Completeness**
    - **Validates: Requirements 6.3**


- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.




- [ ] 4. Extend scheduler service for recurring schedules
  - [x] 4.1 Implement daily schedule trigger logic

    - Add shouldTriggerDaily() function to check if daily schedule should run
    - Implement time matching with 1-minute tolerance

    - _Requirements: 2.1_
  - [x] 4.2 Write property test for daily schedule trigger correctness

    - **Property 3: Daily Schedule Trigger Correctness**
    - **Validates: Requirements 2.1**
  - [x] 4.3 Implement weekly schedule trigger logic

    - Add shouldTriggerWeekly() function to check day and time
    - Implement day-of-week matching with schedule_days array

    - _Requirements: 2.2_
  - [x] 4.4 Write property test for weekly schedule trigger correctness

    - **Property 4: Weekly Schedule Trigger Correctness**

    - **Validates: Requirements 2.2**
  - [ ] 4.5 Implement checkRecurringSchedules() main function
    - Query all enabled recurring schedules
    - Check each schedule against current day/time

    - Trigger streams that match criteria
    - _Requirements: 2.1, 2.2, 2.3_





- [x] 5. Implement schedule enable/disable and conflict handling

  - [ ] 5.1 Add disabled schedule handling
    - Skip disabled schedules in checkRecurringSchedules()
    - Preserve configuration when disabling

    - _Requirements: 3.3_
  - [ ] 5.2 Write property test for disabled schedule no-trigger
    - **Property 5: Disabled Schedule No-Trigger**

    - **Validates: Requirements 3.3**
  - [ ] 5.3 Write property test for schedule enable/disable preservation
    - **Property 6: Schedule Enable/Disable Preservation**




    - **Validates: Requirements 3.4**
  - [ ] 5.4 Implement concurrent stream skip logic
    - Check if stream is already live before triggering

    - Log skip events for already-live streams
    - _Requirements: 5.1_
  - [x] 5.5 Write property test for concurrent stream skip



    - **Property 7: Concurrent Stream Skip**
    - **Validates: Requirements 5.1**


- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



- [ ] 7. Implement next run time calculation
  - [ ] 7.1 Create calculateNextRun() function
    - Calculate next run time for daily schedules
    - Calculate next run time for weekly schedules based on schedule_days
    - Handle edge cases (end of week, timezone)
    - _Requirements: 3.1_
  - [ ] 7.2 Write property test for next run time calculation
    - **Property 9: Next Run Time Calculation**
    - **Validates: Requirements 3.1**

- [ ] 8. Update UI for recurring schedule configuration
  - [ ] 8.1 Update stream modal with schedule type selector
    - Add radio buttons for 'once', 'daily', 'weekly' schedule types
    - Show/hide relevant fields based on selection
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 8.2 Add day selector for weekly schedules
    - Create checkbox group for days of week (Sunday-Saturday)
    - Style to match existing UI design
    - _Requirements: 1.3_
  - [ ] 8.3 Add recurring time input field
    - Add time picker for HH:MM input
    - Validate time format on input
    - _Requirements: 1.2, 1.3_
  - [ ] 8.4 Add enable/disable toggle for recurring schedules
    - Add toggle switch to enable/disable recurring
    - Update UI state based on toggle
    - _Requirements: 3.3, 3.4_

- [ ] 9. Update stream list display
  - [ ] 9.1 Display schedule type and next run time in stream cards
    - Show schedule type badge (Daily/Weekly)
    - Display next scheduled time
    - Show enabled/disabled status
    - _Requirements: 3.1, 3.2_
  - [ ] 9.2 Update stream edit functionality
    - Load existing schedule configuration in edit modal
    - Allow modification of all schedule fields
    - _Requirements: 3.2_

- [ ] 10. Integrate recurring scheduler with main scheduler service
  - [ ] 10.1 Add recurring schedule check to scheduler interval
    - Call checkRecurringSchedules() in existing scheduler interval
    - Ensure proper error handling and logging
    - _Requirements: 2.1, 2.2_
  - [ ] 10.2 Update stream history logging for recurring streams
    - Add schedule_type to stream history records
    - Log recurring stream executions with schedule info
    - _Requirements: 4.1, 4.2_

- [ ] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
