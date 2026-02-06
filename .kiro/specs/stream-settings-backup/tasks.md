# Implementation Plan

- [x] 1. Create Backup Service with export functionality




  - [ ] 1.1 Create `services/backupService.js` with exportStreams function
    - Implement function to fetch all streams for a user
    - Transform stream data to backup format (include only allowed fields)
    - Add metadata (exportDate, appVersion, totalStreams)


    - Return formatted JSON object

    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_
  - [x] 1.2 Write property test for export completeness



    - **Property 1: Export produces complete stream data**
    - **Validates: Requirements 1.1, 1.2**
  - [ ] 1.3 Write property test for export exclusion
    - **Property 2: Export excludes sensitive fields**

    - **Validates: Requirements 1.3**

- [x] 2. Add import functionality to Backup Service

  - [ ] 2.1 Implement validateBackupFormat function
    - Check for valid JSON structure
    - Verify streams array exists
    - Handle files with or without metadata
    - _Requirements: 2.1, 4.3_


  - [x] 2.2 Implement validateStreamConfig function

    - Check required fields (title, rtmp_url, stream_key)
    - Return validation result with errors

    - _Requirements: 2.2_
  - [x] 2.3 Implement importStreams function


    - Parse and validate each stream configuration




    - Create new stream entries for valid configurations
    - Track imported and skipped counts
    - Return summary with counts and errors
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ] 2.4 Write property test for import validation
    - **Property 3: Import validates required fields**
    - **Validates: Requirements 2.2, 2.4**
  - [ ] 2.5 Write property test for import count accuracy
    - **Property 4: Import returns accurate counts**
    - **Validates: Requirements 2.3, 2.5**




  - [ ] 2.6 Write property test for backward compatibility
    - **Property 5: Import accepts files with or without metadata**

    - **Validates: Requirements 4.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 4. Create API endpoints
  - [ ] 4.1 Add GET `/api/streams/export` endpoint in app.js
    - Require authentication
    - Call backupService.exportStreams
    - Set Content-Disposition header with filename format



    - Return JSON file download




    - _Requirements: 1.1, 1.4_
  - [ ] 4.2 Add POST `/api/streams/import` endpoint in app.js
    - Require authentication
    - Handle multipart/form-data file upload
    - Parse JSON file content
    - Call backupService.importStreams
    - Return import summary
    - _Requirements: 2.1, 2.5_

- [ ] 5. Add UI components to dashboard
  - [ ] 5.1 Add backup and import buttons to dashboard.ejs
    - Add buttons in the action area near "New Stream" button
    - Style buttons consistently with existing UI
    - _Requirements: 3.1_
  - [ ] 5.2 Implement exportStreamSettings JavaScript function
    - Trigger API call to export endpoint
    - Handle file download
    - Show success/error notification
    - _Requirements: 3.4, 3.5_
  - [ ] 5.3 Implement importStreamSettings JavaScript function
    - Create hidden file input for JSON files
    - Handle file selection and upload
    - Show loading indicator during import
    - Display import summary notification
    - Refresh stream list after successful import
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Write round-trip property test
  - [ ] 6.1 Write property test for round-trip consistency
    - **Property 6: Round-trip consistency**
    - **Validates: Requirements 1.1, 1.2, 2.3**

- [ ] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
