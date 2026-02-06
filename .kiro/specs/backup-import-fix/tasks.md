# Implementation Plan

- [x] 1. Update EXPORT_FIELDS in backupService.js


  - Add `schedule_time` to EXPORT_FIELDS array
  - Add `stream_duration_minutes` to EXPORT_FIELDS array
  - _Requirements: 1.1, 1.2, 1.3_





- [ ] 2. Fix import status determination logic
  - [x] 2.1 Create `determineImportStatus` helper function


    - Return `scheduled` for `schedule_type` of `daily` or `weekly`


    - Return `scheduled` if `schedule_time` is set

    - Return `offline` as default
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3_
  - [-] 2.2 Update `importStreams` function to use new status logic


    - Replace hardcoded `status: 'offline'` with `determineImportStatus(streamConfig)`
    - _Requirements: 2.1, 2.2_


  - [x] 2.3 Write property test for import status determination


    - **Property 2: Import Status Determination**


    - **Validates: Requirements 2.1, 2.2, 4.1, 4.2, 4.3**



- [ ] 3. Fix import field preservation
  - [x] 3.1 Update `importStreams` to preserve `schedule_time`



    - Add `schedule_time` to streamData object
    - _Requirements: 2.3, 3.3_
  - [ ] 3.2 Ensure `stream_duration_minutes` is correctly handled
    - Preserve original value if present, convert from hours if not
    - _Requirements: 2.3_
  - [ ] 3.3 Write property test for import field preservation
    - **Property 3: Import Field Preservation**
    - **Validates: Requirements 2.3, 2.4, 3.2, 3.3**

- [ ] 4. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Write property test for export completeness
  - **Property 1: Export Completeness**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ] 6. Write property test for round-trip consistency
  - **Property 4: Round-trip Consistency**
  - **Validates: Requirements 3.1**

- [ ] 7. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
