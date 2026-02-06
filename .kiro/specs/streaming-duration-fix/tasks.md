# Implementation Plan

- [x] 1. Create Duration Calculator Utility




  - [ ] 1.1 Create `utils/durationCalculator.js` with `calculateDurationSeconds` function
    - Implement priority logic: stream_duration_minutes > schedule calculation > stream_duration_hours > duration
    - Add validation for positive values




    - Add logging for calculated duration
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

  - [ ] 1.2 Write property test for duration field priority
    - **Property 1: Duration Field Priority**




    - **Validates: Requirements 1.1, 2.1**
  - [ ] 1.3 Write property test for duration conversion consistency
    - **Property 2: Duration Conversion Consistency**

    - **Validates: Requirements 1.2, 2.3**
  - [ ] 1.4 Write property test for schedule duration calculation
    - **Property 3: Schedule Duration Calculation**


    - **Validates: Requirements 2.2, 2.4**


- [x] 2. Fix Duration Tracking in Streaming Service




  - [ ] 2.1 Update `setDurationInfo` function in `services/streamingService.js`
    - Add validation for durationMs > 0

    - Store originalDurationMs for restart calculation
    - Add detailed logging with format "Duration set: X minutes (Y seconds)"
    - _Requirements: 3.1, 3.2, 5.1, 5.2_


  - [x] 2.2 Add `calculateRemainingDuration` function for stream restart



    - Calculate remaining = max(0, originalDuration - elapsed)

    - Use this when stream restarts after error
    - _Requirements: 3.3_

  - [ ] 2.3 Write property test for duration tracking consistency
    - **Property 4: Duration Tracking Consistency**
    - **Validates: Requirements 3.1, 3.2**


  - [x] 2.4 Write property test for remaining duration calculation

    - **Property 7: Remaining Duration Calculation**
    - **Validates: Requirements 3.3**





- [x] 3. Fix FFmpeg Args Builder

  - [ ] 3.1 Update `buildFFmpegArgs` to use `calculateDurationSeconds` from utility
    - Import and use the new duration calculator
    - Remove duplicate duration calculation logic




    - _Requirements: 1.3_
  - [ ] 3.2 Update `buildFFmpegArgsVideoOnly` and `buildFFmpegArgsWithAudio`
    - Ensure `-t` parameter is placed just before RTMP URL


    - Add logging for duration being set




    - _Requirements: 1.3_
  - [ ] 3.3 Write property test for FFmpeg duration parameter
    - **Property 5: FFmpeg Duration Parameter**



    - **Validates: Requirements 1.3**

- [ ] 4. Fix Scheduler Service Duration Check
  - [ ] 4.1 Update `checkStreamDurations` in `services/schedulerService.js`
    - Import and use `calculateDurationSeconds` from utility
    - Use `start_time` instead of `schedule_time` for end time calculation
    - Add detailed logging for duration checks
    - _Requirements: 4.1, 4.4_
  - [ ] 4.2 Implement force stop logic for streams exceeding duration by 60+ seconds
    - Check if stream exceeded end time by more than FORCE_STOP_BUFFER_MS (60000)
    - Force stop immediately if exceeded
    - _Requirements: 4.3_
  - [ ] 4.3 Write property test for scheduler using actual start time
    - **Property 6: Scheduler Uses Actual Start Time**
    - **Validates: Requirements 4.4**
  - [ ] 4.4 Write property test for force stop threshold
    - **Property 8: Force Stop Threshold**
    - **Validates: Requirements 4.3**

- [ ] 5. Update Stream Start Logic
  - [ ] 5.1 Update `startStream` function to use new duration calculator
    - Replace inline duration calculation with `calculateDurationSeconds`
    - Update duration tracking to use calculated value
    - _Requirements: 1.1, 1.2, 3.1_
  - [ ] 5.2 Fix restart logic to use remaining duration
    - When stream restarts after error, calculate remaining duration
    - Pass remaining duration to FFmpeg instead of full duration
    - _Requirements: 3.3_

- [ ] 6. Add Logging Improvements
  - [ ] 6.1 Add consistent logging format for duration events
    - Log "Duration set: X minutes (Y seconds)" when duration calculated
    - Log expected end time in ISO format
    - Log reason when stream stops (duration reached, manual stop, error)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration Testing
  - [ ] 8.1 Write integration test for complete stream duration flow
    - Test stream with stream_duration_minutes set
    - Verify FFmpeg args contain correct -t parameter
    - Verify duration tracking is set correctly
    - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [ ] 9. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

