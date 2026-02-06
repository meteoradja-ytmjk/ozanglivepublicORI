# Implementation Plan

- [x] 1. Add database schema for original settings

  - [x] 1.1 Add original_settings column to streams table


    - Add ALTER TABLE statement in db/database.js
    - Column type: TEXT (for JSON storage)

    - _Requirements: 1.1_



- [ ] 2. Update Backup Service to store original settings on import
  - [ ] 2.1 Modify importStreams function to capture original settings
    - Create originalSettings object from import data


    - Include schedule_time, recurring_time, stream_duration_minutes, schedule_type, schedule_days, recurring_enabled


    - Pass original_settings to Stream.create
    - _Requirements: 1.1_
  
  - [ ] 2.2 Write property test for import preserves original settings
    - **Property 1: Import preserves original settings**


    - **Validates: Requirements 1.1**



- [ ] 3. Update Stream model with reset functionality
  - [ ] 3.1 Update Stream.create to accept original_settings parameter
    - Add original_settings to INSERT statement
    - Serialize JSON before storing

    - _Requirements: 1.1_
  

  - [ ] 3.2 Implement resetToOriginal method
    - Parse original_settings JSON
    - Update stream with original values

    - Return success/skip status
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [ ] 3.3 Implement resetAllToOriginal method
    - Find all streams for user
    - Call resetToOriginal for each
    - Return resetCount and skippedCount
    - _Requirements: 1.2, 1.4, 1.5_

  


  - [ ] 3.4 Write property test for reset restores original values
    - **Property 2: Reset restores original values (Round-trip)**
    - **Validates: Requirements 1.2, 1.3**

  


  - [ ] 3.5 Write property test for reset count accuracy
    - **Property 3: Reset count accuracy**
    - **Validates: Requirements 1.4, 1.5**

- [ ] 4. Add API endpoint for reset all streams
  - [ ] 4.1 Implement POST /api/streams/reset-all endpoint
    - Add route in app.js
    - Call Stream.resetAllToOriginal
    - Return success response with counts
    - _Requirements: 1.2, 1.5, 2.2_

- [ ] 5. Update frontend reset functionality
  - [ ] 5.1 Update resetAllStreamSettings function in dashboard.ejs
    - Update confirmation dialog message to list settings being reset
    - Call POST /api/streams/reset-all API
    - Show success/error toast with counts
    - Reload streams on success
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

- [ ] 6. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
