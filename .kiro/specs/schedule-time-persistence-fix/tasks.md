# Implementation Plan

- [x] 1. Implement formatDateTimeLocal helper function in schedule.ejs




  - [ ] 1.1 Add formatDateTimeLocal function at the beginning of script section
    - Create function that converts UTC ISO string to local datetime-local format
    - Use Date object methods (getFullYear, getMonth, getDate, getHours, getMinutes) for local time


    - Handle null/undefined input gracefully

    - _Requirements: 1.3, 3.1_
  - [x] 1.2 Replace schedule_time display with formatDateTimeLocal


    - Change `new Date(stream.schedule_time).toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.schedule_time)`




    - _Requirements: 1.1_


  - [x] 1.3 Replace end_time display with formatDateTimeLocal

    - Change `new Date(stream.end_time).toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.end_time)`
    - _Requirements: 2.1_


  - [x] 1.4 Write property test for schedule time round-trip

    - **Property 1: Schedule Time Round-Trip Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.2, 3.3**


- [x] 2. Implement formatDateTimeLocal helper function in dashboard.ejs




  - [x] 2.1 Add formatDateTimeLocal function at the beginning of script section


    - Same implementation as schedule.ejs

    - _Requirements: 1.3, 3.1_
  - [x] 2.2 Replace scheduleStartTime display with formatDateTimeLocal


    - Change `startDate.toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.schedule_time)`


    - _Requirements: 1.1_
  - [ ] 2.3 Replace scheduleEndTime display with formatDateTimeLocal


    - Change `endDate.toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.end_time)`
    - _Requirements: 2.1_
  - [ ] 2.4 Replace scheduleEditStartTime display with formatDateTimeLocal
    - Change `new Date(stream.schedule_time).toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.schedule_time)`
    - _Requirements: 1.1_
  - [ ] 2.5 Replace scheduleEditEndTime display with formatDateTimeLocal
    - Change `new Date(stream.end_time).toISOString().slice(0, 16)` to `formatDateTimeLocal(stream.end_time)`
    - _Requirements: 2.1_
  - [ ] 2.6 Write property test for end time round-trip
    - **Property 2: End Time Round-Trip Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ] 3. Verify recurring time handling is correct
  - [ ] 3.1 Review recurring_time handling in schedule.ejs
    - Verify recurring_time is displayed as-is without conversion
    - _Requirements: 4.1, 4.3_
  - [ ] 3.2 Review recurring_time handling in dashboard.ejs
    - Verify recurring_time is displayed as-is without conversion
    - _Requirements: 4.1, 4.3_
  - [ ] 3.3 Write property test for recurring time preservation
    - **Property 3: Recurring Time Preservation**
    - **Validates: Requirements 4.1, 4.3, 5.2**

- [ ] 4. Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Final verification and cleanup
  - [ ] 5.1 Test once schedule type manually
    - Create once schedule, save, reopen, verify time unchanged
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  - [ ] 5.2 Test daily schedule type manually
    - Create daily schedule, save, reopen, verify recurring_time unchanged
    - _Requirements: 4.1, 4.3_
  - [ ] 5.3 Test weekly schedule type manually
    - Create weekly schedule, save, reopen, verify recurring_time and days unchanged
    - _Requirements: 4.1, 4.3_
  - [ ] 5.4 Write unit tests for formatDateTimeLocal function
    - **Property 4: Local Time Display Correctness**
    - **Validates: Requirements 3.1, 5.3**

- [ ] 6. Final Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
