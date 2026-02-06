# Implementation Plan

- [x] 1. Create FileQueueManager utility class




  - [ ] 1.1 Create file queue manager with core data structures
    - Create `public/js/fileQueueManager.js` with FileQueueManager class
    - Implement `files` array, `currentIndex`, `isUploading` state
    - Implement `addFiles()` method to add files to queue with validation
    - Implement `removeFile(index)` method to remove file from queue


    - Implement `getFiles()` and `getOverallProgress()` methods

    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  - [x] 1.2 Write property test for file filter




    - **Property 1: File Filter Correctness**
    - **Validates: Requirements 1.4, 2.4**
  - [ ] 1.3 Write property test for queue removal
    - **Property 3: Queue Removal Isolation**
    - **Validates: Requirements 4.2**



- [x] 2. Implement upload processing logic

  - [ ] 2.1 Add upload processing methods to FileQueueManager
    - Implement `startUpload()` method for sequential file upload

    - Implement `uploadFile(item)` method using XMLHttpRequest with progress
    - Implement `cancelCurrent()` method to abort current upload

    - Implement `cancelAll()` method to stop all and clear queue
    - Implement `retryFailed()` method to retry only failed files




    - Add callback hooks: onProgress, onFileComplete, onAllComplete
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_
  - [ ] 2.2 Write property test for state transitions
    - **Property 4: Upload State Transitions**
    - **Validates: Requirements 3.2, 3.3**

  - [ ] 2.3 Write property test for progress calculation
    - **Property 5: Overall Progress Calculation**
    - **Validates: Requirements 3.5**
  - [ ] 2.4 Write property test for sequential processing
    - **Property 7: Sequential Processing**
    - **Validates: Requirements 6.1**


  - [x] 2.5 Write property test for error resilience

    - **Property 8: Error Resilience**
    - **Validates: Requirements 5.1**



- [ ] 3. Update Video Upload Modal UI
  - [ ] 3.1 Modify video upload modal for multiple file selection
    - Update file input to support `multiple` attribute
    - Update dropzone to handle multiple files via DataTransfer
    - Create file list UI component showing name, size, status per file
    - Add remove button for each file in the list

    - Add Cancel All button
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.3_
  - [ ] 3.2 Add progress tracking UI for video upload
    - Add individual progress bar for each file
    - Add success/error indicators per file
    - Add overall progress bar

    - Add upload summary section (success/failed counts)

    - Add Retry Failed button
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.2, 5.3_
  - [ ] 3.3 Write property test for file list display
    - **Property 2: File List Display Completeness**
    - **Validates: Requirements 1.3, 2.3**
  - [ ] 3.4 Write property test for summary accuracy
    - **Property 6: Summary Accuracy**

    - **Validates: Requirements 3.4, 5.2**

- [ ] 4. Update Audio Upload Modal UI
  - [ ] 4.1 Modify audio upload modal for multiple file selection
    - Update file input to support `multiple` attribute
    - Update dropzone to handle multiple files via DataTransfer
    - Create file list UI component showing name, size, status per file


    - Add remove button for each file in the list




    - Add Cancel All button



    - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.3_
  - [ ] 4.2 Add progress tracking UI for audio upload
    - Add individual progress bar for each file
    - Add success/error indicators per file
    - Add overall progress bar
    - Add upload summary section (success/failed counts)
    - Add Retry Failed button
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.2, 5.3_

- [ ] 5. Integrate FileQueueManager with Upload Modals
  - [ ] 5.1 Wire up video upload modal with FileQueueManager
    - Initialize FileQueueManager instance for video uploads
    - Connect file input and dropzone to addFiles()
    - Connect upload button to startUpload()
    - Connect cancel buttons to cancelCurrent() and cancelAll()
    - Connect retry button to retryFailed()
    - Update UI based on callbacks
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 4.2, 4.3, 4.4, 5.3_
  - [ ] 5.2 Wire up audio upload modal with FileQueueManager
    - Initialize FileQueueManager instance for audio uploads
    - Connect file input and dropzone to addFiles()
    - Connect upload button to startUpload()
    - Connect cancel buttons to cancelCurrent() and cancelAll()
    - Connect retry button to retryFailed()
    - Update UI based on callbacks
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 4.3, 4.4, 5.3_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Write integration test for database record integrity
  - [ ] 7.1 Write property test for database record integrity
    - **Property 9: Database Record Integrity**
    - **Validates: Requirements 6.3**

- [ ] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
