# Implementation Plan

- [x] 1. Create DriveImportQueueManager utility class




  - [ ] 1.1 Create DriveImportQueueManager with core functionality
    - Create `public/js/driveImportQueueManager.js` with DriveImportQueueManager class
    - Implement `parseLinks(text)` method to split textarea content into array of links
    - Implement `validateLink(link)` method to check Google Drive URL format
    - Implement `validateAllLinks(links)` method to validate array of links
    - Implement state management (links, batchId, isProcessing, isCancelled)


    - Implement `getStatusCounts()` method

    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 1.2 Write property test for link parsing




    - **Property 1: Link Parsing Correctness**
    - **Validates: Requirements 1.2**
  - [ ] 1.3 Write property test for link validation
    - **Property 2: Link Validation Correctness**
    - **Validates: Requirements 1.3, 1.4**


- [x] 2. Implement backend batch import API for videos

  - [ ] 2.1 Add batch import endpoints to app.js
    - Implement `POST /api/videos/import-drive-batch` endpoint

    - Implement `GET /api/videos/import-batch-status/:batchId` endpoint
    - Implement `POST /api/videos/import-batch-cancel/:batchId` endpoint
    - Implement `processBatchVideoImport()` function for sequential processing

    - Store batch jobs in memory with status tracking per file
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 6.1, 6.2_
  - [ ] 2.2 Write property test for status tracking
    - **Property 3: Status Tracking Completeness**
    - **Validates: Requirements 2.1, 2.3, 2.4**
  - [x] 2.3 Write property test for progress bounds

    - **Property 4: Progress Bounds**

    - **Validates: Requirements 2.2**
  - [ ] 2.4 Write property test for sequential processing
    - **Property 7: Sequential Processing**
    - **Validates: Requirements 6.1**

- [x] 3. Implement backend batch import API for audio

  - [ ] 3.1 Add batch import endpoints for audio
    - Implement `POST /api/audios/import-drive-batch` endpoint

    - Implement `GET /api/audios/import-batch-status/:batchId` endpoint
    - Implement `POST /api/audios/import-batch-cancel/:batchId` endpoint

    - Implement `processBatchAudioImport()` function
    - _Requirements: 5.1, 5.2, 5.3_





- [ ] 4. Add import methods to DriveImportQueueManager
  - [ ] 4.1 Implement import and polling methods
    - Implement `startImport(links)` method to call batch API
    - Implement `pollStatus()` method to poll batch status
    - Implement `cancelAll()` method to cancel batch
    - Implement `retryFailed()` method to retry failed imports

    - Add callback hooks: onProgress, onFileComplete, onAllComplete, onQueueUpdate

    - _Requirements: 3.3, 4.1, 4.2, 4.3_
  - [ ] 4.2 Write property test for error resilience
    - **Property 5: Error Resilience**
    - **Validates: Requirements 3.1**
  - [ ] 4.3 Write property test for summary accuracy
    - **Property 6: Summary Accuracy**
    - **Validates: Requirements 3.2**
  - [x] 4.4 Write property test for cancel state preservation

    - **Property 8: Cancel State Preservation**

    - **Validates: Requirements 4.2, 4.3**

- [ ] 5. Update Video Google Drive Modal UI
  - [ ] 5.1 Modify video Google Drive modal for multiple links
    - Replace single input with textarea for multiple links
    - Add placeholder text explaining one link per line
    - Create file list UI showing each link with status
    - Add progress bar per file

    - Add Cancel All button
    - Add Retry Failed button
    - Add summary section showing success/failed counts
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 4.1_

- [ ] 6. Update Audio Google Drive Modal UI
  - [ ] 6.1 Modify audio Google Drive modal for multiple links
    - Replace single input with textarea for multiple links

    - Add placeholder text explaining one link per line
    - Create file list UI showing each link with status


    - Add progress bar per file
    - Add Cancel All button
    - Add Retry Failed button
    - Add summary section showing success/failed counts
    - _Requirements: 5.1, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 4.1_

- [ ] 7. Integrate DriveImportQueueManager with Modals
  - [ ] 7.1 Wire up video Google Drive modal
    - Initialize DriveImportQueueManager instance for video imports
    - Connect textarea to parseLinks() and validateAllLinks()
    - Connect import button to startImport()
    - Connect cancel button to cancelAll()
    - Connect retry button to retryFailed()
    - Update UI based on callbacks
    - Refresh gallery on completion
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1, 4.2, 6.3_
  - [ ] 7.2 Wire up audio Google Drive modal
    - Initialize DriveImportQueueManager instance for audio imports
    - Connect textarea to parseLinks() and validateAllLinks()
    - Connect import button to startImport()
    - Connect cancel button to cancelAll()
    - Connect retry button to retryFailed()
    - Update UI based on callbacks
    - Refresh gallery on completion
    - _Requirements: 5.1, 1.2, 1.3, 3.1, 4.1, 4.2, 6.3_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
