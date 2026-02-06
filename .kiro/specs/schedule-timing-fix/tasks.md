# Implementation Plan

- [x] 1. Fix trigger timing logic in schedulerService.js

  - [x] 1.1 Update SCHEDULE_LOOKAHEAD_SECONDS constant from 180 to 60


    - Change lookahead from 3 minutes to 1 minute for one-time schedules


    - _Requirements: 1.2_
  - [x] 1.2 Update shouldTriggerDaily function trigger window


    - Change `timeDiff >= -2 && timeDiff <= 10` to `timeDiff >= 0 && timeDiff <= 5`
    - Update comments to reflect new behavior


    - _Requirements: 1.1, 1.2, 2.1_

  - [ ] 1.3 Update shouldTriggerWeekly function trigger window
    - Change `timeDiff >= -2 && timeDiff <= 10` to `timeDiff >= 0 && timeDiff <= 5`

    - Update comments to reflect new behavior
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.4 Write property test for no early trigger


    - **Property 1: No Early Trigger**



    - **Validates: Requirements 1.2, 2.3**
  - [ ] 1.5 Write property test for trigger within valid window
    - **Property 2: Trigger Within Valid Window**
    - **Validates: Requirements 1.1, 2.1, 2.2**
  - [ ] 1.6 Write property test for missed schedule boundary
    - **Property 3: Missed Schedule Boundary**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 2. Update logging for better debugging
  - [ ] 2.1 Enhance log messages in shouldTriggerDaily and shouldTriggerWeekly
    - Add clear indication when trigger is within valid window vs missed schedule
    - _Requirements: 1.4, 3.3_

- [ ] 3. Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

