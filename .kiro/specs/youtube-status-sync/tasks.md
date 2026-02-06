# Implementation Plan

- [x] 1. Add YouTube API methods for status checking




  - [ ] 1.1 Add getBroadcastStatus method to youtubeService.js
    - Implement method to get broadcast lifecycle status by broadcast ID
    - Return { lifeCycleStatus, exists } object
    - Handle broadcast not found case

    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Add findBroadcastByStreamKey method to youtubeService.js
    - Implement method to search active broadcasts by stream key

    - Return matching broadcast ID and status, or null if not found
    - _Requirements: 3.2_

  - [x] 1.3 Add listActiveBroadcasts method to youtubeService.js


    - Implement method to list broadcasts with status "live" or "testing"

    - Return array with id, streamKey, lifeCycleStatus
    - _Requirements: 1.1, 3.2_




  - [ ] 1.4 Write property test for status display mapping
    - **Property 4: Status display mapping**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. Create YouTubeStatusSync service

  - [ ] 2.1 Create services/youtubeStatusSync.js
    - Implement YouTubeStatusSync class with activeChecks Map
    - Add quotaExceededUntil tracking
    - Add STATUS_DISPLAY mapping constant
    - Implement mapStatusToDisplay static method
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_


  - [ ] 2.2 Implement startMonitoring method
    - Check if user has valid YouTube credentials
    - Find matching broadcast by stream key
    - Start 60-second polling interval

    - Store monitoring state in activeChecks Map
    - _Requirements: 1.1, 1.4, 3.1, 3.2_

  - [ ] 2.3 Implement stopMonitoring method
    - Clear polling interval
    - Remove from activeChecks Map

    - Clean up resources
    - _Requirements: 1.2, 1.3_


  - [x] 2.4 Implement checkBroadcastStatus method

    - Call YouTubeService.getBroadcastStatus
    - If status is "complete" or "revoked", stop stream
    - If broadcast deleted, stop stream

    - Handle API errors gracefully
    - _Requirements: 1.2, 1.3, 1.5_

  - [ ] 2.5 Implement quota handling methods
    - Implement handleQuotaExceeded to set 1-hour cooldown



    - Implement isQuotaCooldown to check cooldown status
    - Log warning when quota exceeded
    - _Requirements: 4.1, 4.2, 4.3, 4.4_


  - [ ] 2.6 Write property test for quota cooldown behavior
    - **Property 7: Quota cooldown behavior**
    - **Validates: Requirements 4.1, 4.2, 4.4**


- [x] 3. Checkpoint - Make sure all tests are passing

  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate with StreamingService

  - [ ] 4.1 Modify startStream in streamingService.js
    - After FFmpeg confirmed running, check if platform is "YouTube"
    - If YouTube, call youtubeStatusSync.startMonitoring()
    - Pass streamId, userId, and streamKey
    - _Requirements: 1.1, 3.1, 3.4_

  - [ ] 4.2 Modify stopStream in streamingService.js
    - Call youtubeStatusSync.stopMonitoring() to clean up



    - Ensure cleanup happens for all stop scenarios
    - _Requirements: 1.2, 1.3_


  - [ ] 4.3 Add getYouTubeStatus method to streamingService.js
    - Return current YouTube lifecycle status for a stream





    - Return null if not a YouTube stream or not monitored
    - _Requirements: 2.1_

  - [ ] 4.4 Write property test for YouTube stream monitoring activation
    - **Property 1: YouTube stream monitoring activation**


    - **Validates: Requirements 1.1, 3.1**

  - [ ] 4.5 Write property test for non-YouTube stream isolation
    - **Property 5: Non-YouTube stream isolation**
    - **Validates: Requirements 3.4**

- [ ] 5. Add database columns for caching (optional)
  - [ ] 5.1 Add youtube_broadcast_id column to streams table
    - ALTER TABLE streams ADD COLUMN youtube_broadcast_id TEXT
    - _Requirements: 3.2_

  - [ ] 5.2 Add youtube_lifecycle_status column to streams table
    - ALTER TABLE streams ADD COLUMN youtube_lifecycle_status TEXT
    - _Requirements: 2.1_

- [ ] 6. Update UI to show YouTube status
  - [ ] 6.1 Add YouTube status display to stream cards
    - Show lifecycle status badge for YouTube streams
    - Use Indonesian labels from STATUS_DISPLAY mapping
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 6.2 Add API endpoint for YouTube status
    - GET /api/streams/:id/youtube-status
    - Return current YouTube lifecycle status
    - _Requirements: 2.1_

- [ ] 7. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

