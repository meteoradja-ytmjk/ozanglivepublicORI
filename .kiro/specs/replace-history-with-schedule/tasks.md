# Implementation Plan

- [x] 1. Update navigation to replace History with Schedule
  - [x] 1.1 Update desktop sidebar in layout.ejs
    - Change href from `/history` to `/schedule`
    - Change icon from `ti-clock-hour-4` to `ti-calendar-event`
    - Change label from "History" to "Schedule"
    - Change active check from `active === 'history'` to `active === 'schedule'`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Update mobile bottom navigation in layout.ejs
    - Apply same changes as desktop sidebar
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Extend Stream model with findAllScheduled method
  - [x] 2.1 Add findAllScheduled static method to Stream.js
    - Query streams with schedule_time OR recurring schedule (daily/weekly)
    - Include video and audio joins
    - Return streams sorted by schedule type and time
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Write property test for schedule grouping
    - **Property 1: Schedule grouping by type**
    - **Validates: Requirements 2.1, 3.2**
  - [x] 2.3 Write property test for next run time calculation
    - **Property 3: Next run time calculation for recurring streams**
    - **Validates: Requirements 2.3**

- [x] 3. Create schedule route in app.js
  - [x] 3.1 Add GET /schedule route
    - Call Stream.findAllScheduled with user_id
    - Compute nextRunTime for recurring streams
    - Group streams by schedule_type
    - Filter today's schedules
    - Render schedule.ejs with data
    - _Requirements: 1.2, 2.1, 2.3, 4.1, 4.2_

- [x] 4. Create schedule.ejs view
  - [x] 4.1 Create basic page structure with header and filter
    - Page title "Schedule"
    - Filter dropdown (All, Once, Daily, Weekly)
    - _Requirements: 3.1_
  - [x] 4.2 Implement Today's Schedule section
    - Display streams scheduled for today
    - Show time remaining until start
    - Empty state if no streams today
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.3 Implement grouped schedule sections
    - Once schedules with date/time
    - Daily schedules with recurring time
    - Weekly schedules with days and time
    - Edit button for each stream
    - _Requirements: 2.1, 2.2, 2.3, 5.1_
  - [x] 4.4 Implement empty state
    - Show when no scheduled streams exist
    - Helpful message with link to create stream
    - _Requirements: 2.4_
  - [x] 4.5 Implement client-side filter functionality
    - Filter streams by schedule type
    - Update display without page reload
    - _Requirements: 3.2, 3.3_
  - [x] 4.6 Write property test for filter functionality
    - **Property 5: Filter produces correct subset**
    - **Validates: Requirements 3.2**

- [x] 5. Implement responsive layout
  - [x] 5.1 Desktop layout with table/card view
    - Full details display
    - _Requirements: 6.1_
  - [x] 5.2 Mobile layout with compact cards
    - Optimized for small screens
    - _Requirements: 6.2, 6.3_

- [x] 6. Implement edit stream functionality
  - [x] 6.1 Add edit button that opens existing stream modal
    - Reuse openEditStreamModal function from dashboard
    - Pre-fill with stream data
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Handle schedule update and refresh display
    - Update schedule list after save
    - _Requirements: 5.3_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Write property test for today's schedule ordering
  - **Property 4: Today's schedule chronological ordering**
  - **Validates: Requirements 4.2**

- [x] 9. Final Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
