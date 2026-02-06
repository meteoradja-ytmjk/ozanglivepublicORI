# Implementation Plan

## CPU Optimization for Streaming Service

- [x] 1. Optimize FFmpeg arguments for copy mode (video only)




  - [ ] 1.1 Update `buildFFmpegArgsVideoOnly` function to add thread limiting
    - Add `-threads 2` parameter at the beginning of arguments
    - Add `-thread_queue_size 512` for memory optimization
    - Reduce `-bufsize` from `4M` to `1M`
    - Reduce `-max_muxing_queue_size` from `7000` to `2048`


    - Add `-flvflags no_duration_filesize` for FLV overhead reduction

    - _Requirements: 1.2, 1.5, 3.1, 3.4, 8.1_
  - [x] 1.2 Write property test for thread limiting in video-only mode




    - **Property 1: Thread Limiting Present**
    - **Validates: Requirements 1.2, 3.1**
  - [ ] 1.3 Write property test for copy mode parameters
    - **Property 2: Copy Mode for Non-Advanced Streams**
    - **Validates: Requirements 1.3, 1.5**

- [x] 2. Optimize FFmpeg arguments for audio merge mode

  - [ ] 2.1 Update `buildFFmpegArgsWithAudio` function with optimizations
    - Add `-threads 2` parameter at the beginning




    - Add `-thread_queue_size 512` for memory optimization
    - Reduce `-bufsize` from `4M` to `1M`
    - Reduce `-max_muxing_queue_size` from `7000` to `2048`
    - Add `-flvflags no_duration_filesize`
    - Keep `-c:v copy` for video (no re-encoding)

    - Keep `-c:a aac -b:a 128k` for audio encoding (required for merge)
    - _Requirements: 1.2, 2.4, 3.1, 3.4, 8.1_

  - [ ] 2.2 Write property test for audio bitrate minimum
    - **Property 4: Audio Bitrate Minimum**

    - **Validates: Requirements 2.4**



- [x] 3. Optimize FFmpeg arguments for playlist mode

  - [ ] 3.1 Update `buildFFmpegArgsForPlaylist` function with optimizations
    - Add `-threads 2` parameter for non-advanced mode


    - Add `-thread_queue_size 512`
    - Reduce buffer sizes for non-advanced mode

    - For advanced mode: change preset from `veryfast` to `ultrafast`




    - Add `-profile:v baseline` for YouTube compatibility when encoding
    - _Requirements: 1.2, 2.2, 3.2, 6.4_
  - [x] 3.2 Write property test for playlist optimization

    - **Property 7: Playlist Optimization Compatible**
    - **Validates: Requirements 6.4**
  - [x] 3.3 Write property test for ultrafast preset

    - **Property 3: Ultrafast Preset for Encoding**
    - **Validates: Requirements 2.2, 3.2**


- [x] 4. Checkpoint - Verify FFmpeg optimizations

  - Ensure all tests pass, ask the user if questions arise.





- [-] 5. Optimize buffer and stability settings

  - [x] 5.1 Add `-fflags +discardcorrupt` to handle corrupt frames

    - Update all three build functions to include this flag
    - This prevents stream crashes from corrupt video frames

    - _Requirements: 8.2, 8.5_
  - [x] 5.2 Write property test for buffer settings

    - **Property 5: Buffer Settings Optimized**



    - **Validates: Requirements 3.4, 8.1**

  - [x] 5.3 Write property test for essential parameters

    - **Property 6: Essential Parameters Preserved**
    - **Validates: Requirements 6.2**

- [x] 6. Fix duration calculation and placement



  - [ ] 6.1 Verify duration calculation accuracy
    - Ensure `stream_duration_hours * 3600` calculation is correct
    - Ensure end_time - start_time calculation uses actual start time
    - Add logging for duration calculation verification
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ] 6.2 Verify -t parameter placement in all build functions
    - Confirm -t appears before rtmpUrl in arguments array
    - Test with both copy mode and encoding mode
    - _Requirements: 9.4_
  - [ ] 6.3 Write property test for duration calculation
    - **Property 8: Duration Hours to Seconds Conversion**
    - **Validates: Requirements 9.1**
  - [ ] 6.4 Write property test for duration from end time
    - **Property 9: Duration from End Time Calculation**
    - **Validates: Requirements 9.2**
  - [ ] 6.5 Write property test for -t parameter placement
    - **Property 10: Duration Parameter Placement**
    - **Validates: Requirements 9.4**

- [ ] 7. Optimize loop with duration handling
  - [ ] 7.1 Verify loop parameters work correctly with duration
    - Ensure `-stream_loop -1` appears before `-i` input
    - Ensure `-t` duration appears before output URL
    - Test audio loop sync with video duration
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ] 7.2 Write property test for loop with duration
    - **Property 11: Loop with Duration Correct Order**
    - **Validates: Requirements 10.1**
  - [ ] 7.3 Write property test for audio loop sync
    - **Property 12: Audio Loop Sync**
    - **Validates: Requirements 10.2**

- [ ] 8. Optimize background sync process
  - [ ] 8.1 Increase sync interval from 5 minutes to 10 minutes
    - Change `setInterval(syncStreamStatuses, 5 * 60 * 1000)` to `10 * 60 * 1000`
    - This reduces database query frequency by 50%
    - _Requirements: 4.2_

- [ ] 9. Add optimization logging
  - [ ] 9.1 Add logging for optimization mode detection
    - Log whether copy mode or encoding mode is used
    - Log thread count being applied
    - Log buffer sizes being used
    - _Requirements: 5.1, 5.2_

- [ ] 10. Final Checkpoint - Verify all optimizations
  - Ensure all tests pass, ask the user if questions arise.
