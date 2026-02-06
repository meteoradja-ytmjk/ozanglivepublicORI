# Implementation Plan

## 1. Fix Mobile Schedule UI Visibility

- [x] 1.1 Update setScheduleType function to properly hide/show fields
  - Modify `public/js/stream-modal.js`
  - Ensure `onceScheduleSettings` is hidden when Daily/Weekly selected
  - Ensure `recurringScheduleSettings` is shown when Daily/Weekly selected
  - Test on both mobile and desktop viewports
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.2 Write property test for schedule type visibility
  - **Property 1: Schedule Type Visibility Consistency**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 1.3 Remove duplicate UI elements in dashboard.ejs
  - Review `views/dashboard.ejs` for duplicate labels/text
  - Remove redundant elements in schedule form
  - Ensure single instance of each label for Daily/Weekly modes
  - _Requirements: 2.4, 2.5_

- [x] 1.4 Write property test for no duplicate UI elements
  - **Property 3: No Duplicate UI Elements**
  - **Validates: Requirements 2.4, 2.5**

## 2. Verify Recurring Schedule Fields

- [x] 2.1 Verify recurring schedule fields visibility logic
  - Ensure Stream Time field shows for Daily mode
  - Ensure Day Selector shows only for Weekly mode
  - Ensure Enable Recurring toggle shows for both Daily/Weekly
  - _Requirements: 2.1, 2.2_

- [x] 2.2 Write property test for recurring schedule fields visibility
  - **Property 2: Recurring Schedule Fields Visibility**
  - **Validates: Requirements 2.1, 2.2**

## 3. Checkpoint - UI Tests
- [x] 3. Ensure all tests pass, ask the user if questions arise.

## 4. Fix Stream Auto-Termination

- [x] 4.1 Review and fix duration-based termination in streamingService.js
  - Verify FFmpeg `-t` flag is correctly applied
  - Ensure `stream_duration_hours` is converted to seconds properly
  - Test duration termination works as expected
  - _Requirements: 3.1_

- [x] 4.2 Implement end time termination in schedulerService.js
  - Add logic to check `schedule_end_time` field
  - Schedule termination based on end time
  - Handle case where both duration and end time are set (use earlier)
  - _Requirements: 3.2_

- [x] 4.3 Write property test for stream auto-termination
  - **Property 4: Stream Auto-Termination**
  - **Validates: Requirements 3.1, 3.2**

## 5. Fix Status Synchronization

- [x] 5.1 Improve status update on stream stop
  - Ensure database status is updated to 'offline' when FFmpeg exits
  - Handle all exit scenarios (manual stop, duration, end time, error)
  - Verify `syncStreamStatuses()` catches orphaned streams
  - _Requirements: 3.3, 3.5_

- [x] 5.2 Verify dashboard reflects accurate status
  - Ensure frontend polls/receives status updates
  - Test status display after auto-termination
  - _Requirements: 3.4_

- [x] 5.3 Write property test for status update on stream stop
  - **Property 5: Status Update on Stream Stop**
  - **Validates: Requirements 3.3, 3.4, 3.5**

## 6. Final Checkpoint
- [x] 6. Ensure all tests pass, ask the user if questions arise.
