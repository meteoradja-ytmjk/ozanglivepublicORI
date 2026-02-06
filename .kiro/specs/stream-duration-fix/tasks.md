# Implementation Plan

- [x] 1. Fix FFmpeg duration parameter placement




  - [ ] 1.1 Fix buildFFmpegArgsWithAudio function to place -t parameter before output URL
    - Move `-t` parameter to be placed just before `-f flv` and rtmpUrl


    - Ensure duration is calculated correctly from stream_duration_hours


    - _Requirements: 1.1, 2.1_




  - [ ] 1.2 Fix buildFFmpegArgsVideoOnly function to place -t parameter before output URL
    - Same fix as 1.1 for video-only streaming


    - _Requirements: 1.1, 2.1_
  - [x] 1.3 Write property test for FFmpeg args duration parameter

    - **Property 5: Dual Mechanism Activation**
    - **Validates: Requirements 2.1**



- [ ] 2. Implement stream duration tracking
  - [ ] 2.1 Create streamDurationInfo Map in streamingService.js
    - Add Map to track startTime, durationMs, expectedEndTime for each stream

    - Add helper functions: setDurationInfo, getDurationInfo, clearDurationInfo
    - _Requirements: 1.1, 3.1_

  - [ ] 2.2 Update startStream to populate duration tracking
    - Calculate and store expectedEndTime when stream starts with duration
    - Log duration info for debugging

    - _Requirements: 1.1, 4.1_



  - [ ] 2.3 Write property test for end time calculation
    - **Property 1: End Time Calculation Correctness**
    - **Validates: Requirements 1.1, 3.1**


- [ ] 3. Implement remaining time and warning functions
  - [ ] 3.1 Add getRemainingTime function to streamingService.js
    - Calculate remaining time based on expectedEndTime - currentTime

    - Return null if no duration set
    - _Requirements: 3.1_



  - [ ] 3.2 Add isStreamEndingSoon function for warning detection
    - Return true if remaining time < 5 minutes (300000ms)
    - _Requirements: 3.2_


  - [ ] 3.3 Write property test for warning threshold
    - **Property 7: Warning Threshold Detection**

    - **Validates: Requirements 3.2**





- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Fix FFmpeg exit handling for duration completion

  - [ ] 5.1 Add isStreamDurationExceeded function
    - Check if current time >= expectedEndTime



    - Used to determine if exit is due to duration completion
    - _Requirements: 1.4_
  - [x] 5.2 Update FFmpeg exit handler to detect duration-based exit

    - If exit code 0 AND duration exceeded, do not restart
    - If exit code != 0 AND duration exceeded, do not restart


    - Only restart if duration NOT exceeded and retry count < max
    - _Requirements: 1.4_
  - [ ] 5.3 Write property test for no restart on duration exit
    - **Property 4: No Restart on Normal Duration Exit**
    - **Validates: Requirements 1.4**

- [ ] 6. Enhance scheduler termination reliability
  - [ ] 6.1 Update scheduleStreamTermination to use exact end time
    - Calculate remaining time from expectedEndTime instead of just duration
    - Add small buffer (30 seconds) to ensure FFmpeg -t has time to work first
    - _Requirements: 2.1, 2.2_
  - [ ] 6.2 Reduce periodic check interval to 30 seconds
    - Change checkStreamDurations interval from 60s to 30s
    - Add force stop for streams exceeding duration by more than 1 minute
    - _Requirements: 2.3_
  - [ ] 6.3 Write property test for stream termination guarantee
    - **Property 2: Stream Termination Guarantee**
    - **Validates: Requirements 1.2, 2.2, 2.3**

- [ ] 7. Implement resource cleanup
  - [ ] 7.1 Update stopStream to clear duration tracking
    - Remove stream from streamDurationInfo Map
    - Ensure termination timer is cancelled
    - _Requirements: 2.4_
  - [ ] 7.2 Update handleStreamStopped to cleanup all resources
    - Clear duration info, cancel timers, update status
    - _Requirements: 2.4_
  - [ ] 7.3 Write property test for resource cleanup
    - **Property 6: Resource Cleanup on Stop**
    - **Validates: Requirements 2.4**

- [ ] 8. Update status handling for duration completion
  - [ ] 8.1 Ensure status is set to offline when duration reached
    - Update Stream.updateStatus call with proper end_time
    - Add duration_exceeded flag to history
    - _Requirements: 1.3_
  - [ ] 8.2 Write property test for status update
    - **Property 3: Status Update on Duration Completion**
    - **Validates: Requirements 1.3**

- [ ] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
