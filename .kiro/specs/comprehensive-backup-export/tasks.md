# Implementation Plan

- [x] 1. Extend Backup Service with category exporters




  - [x] 1.1 Add export field constants for each category (YouTube credentials, broadcast templates, recurring schedules, stream templates, playlists)


    - Define YOUTUBE_CREDENTIALS_FIELDS, BROADCAST_TEMPLATE_FIELDS, RECURRING_SCHEDULE_FIELDS, STREAM_TEMPLATE_FIELDS, PLAYLIST_FIELDS
    - _Requirements: 2.3, 3.1, 4.1, 5.1, 6.1_

  - [ ] 1.2 Implement exportYouTubeCredentials function
    - Export all credentials for user with required fields
    - Handle is_primary flag correctly
    - _Requirements: 2.3_

  - [ ] 1.3 Implement exportBroadcastTemplates function
    - Export all templates with recurring configuration
    - Include account_id, thumbnail_path, stream_id references
    - Parse JSON fields (tags, recurring_days)

    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 1.4 Implement exportRecurringSchedules function
    - Export all schedules with pattern, schedule_time, days_of_week

    - Include template_id and account_id references
    - Preserve is_active and next_run_at
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.5 Implement exportStreamTemplates function


    - Export all templates with video_id, audio_id, duration settings




    - Preserve schedule_type, recurring_time, schedule_days
    - _Requirements: 5.1, 5.2_
  - [x] 1.6 Implement exportPlaylists function

    - Export playlist metadata (name, description, is_shuffle)
    - Include videos array with video_id and position
    - Preserve video order

    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 1.7 Write property test for field completeness
    - **Property 4: Field completeness for each category**

    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2**


- [ ] 2. Implement comprehensive export function
  - [x] 2.1 Create comprehensiveExport function

    - Accept userId and optional categories array
    - Call individual exporters based on selection

    - Generate metadata with timestamp, version, counts

    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_
  - [ ] 2.2 Implement selective category export
    - Filter categories based on user selection
    - Default to all categories when no selection

    - _Requirements: 2.1, 2.2_
  - [ ] 2.3 Add JSON pretty-print formatting
    - Format output with proper indentation
    - Use consistent key ordering

    - _Requirements: 9.1, 9.2_
  - [ ] 2.4 Write property test for comprehensive export
    - **Property 2: Comprehensive export includes all categories**
    - **Validates: Requirements 1.1, 1.3, 2.2**

  - [ ] 2.5 Write property test for selective export
    - **Property 3: Selective export respects category selection**
    - **Validates: Requirements 2.1**


- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement category importers with validation

  - [ ] 4.1 Implement validateComprehensiveBackup function
    - Validate backup structure and metadata
    - Check version compatibility
    - Return validation errors

    - _Requirements: 7.1_
  - [x] 4.2 Implement importYouTubeCredentials function

    - Validate refresh_token presence
    - Handle duplicate detection (by channel_id)

    - Support skip/overwrite options

    - _Requirements: 7.4, 8.2_
  - [ ] 4.3 Implement importBroadcastTemplates function
    - Validate recurring configuration completeness
    - Handle account_id reference validation

    - Support skip/overwrite options
    - _Requirements: 7.4, 8.3_
  - [ ] 4.4 Implement importRecurringSchedules function
    - Validate required fields
    - Handle template_id and account_id references

    - Log warnings for invalid references
    - _Requirements: 7.4, 8.4_
  - [x] 4.5 Implement importStreamTemplates function

    - Validate required fields
    - Handle video_id and audio_id references

    - Support skip/overwrite options
    - _Requirements: 7.4_

  - [ ] 4.6 Implement importPlaylists function
    - Import playlist metadata




    - Import video associations with positions
    - Preserve video order
    - _Requirements: 6.3, 7.4_

  - [ ] 4.7 Write property test for import validation
    - **Property 6: Import validation rejects invalid data**
    - **Validates: Requirements 7.1, 8.2, 8.3, 8.4**
  - [x] 4.8 Write property test for playlist order preservation

    - **Property 5: Playlist video order preservation**
    - **Validates: Requirements 6.3**





- [ ] 5. Implement comprehensive import function
  - [x] 5.1 Create comprehensiveImport function

    - Accept backup data, userId, and options
    - Import in correct order (credentials → templates → schedules)
    - Return detailed results per category
    - _Requirements: 7.2, 7.3_

  - [ ] 5.2 Implement import order logic
    - Import YouTube credentials first
    - Import broadcast templates and stream templates

    - Import recurring schedules last (depends on templates)

    - Import playlists (independent)
    - _Requirements: 7.2_
  - [ ] 5.3 Implement result aggregation
    - Track imported, skipped, failed counts per category


    - Collect warnings for reference issues
    - _Requirements: 7.3_
  - [ ] 5.4 Write property test for result reporting
    - **Property 7: Import result reporting accuracy**
    - **Validates: Requirements 7.3**
  - [ ] 5.5 Write property test for duplicate handling
    - **Property 8: Duplicate handling options work correctly**
    - **Validates: Requirements 7.4**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Add API endpoints
  - [ ] 7.1 Add POST /api/backup/export-all endpoint
    - Accept optional categories in request body
    - Return JSON backup file
    - Set appropriate Content-Disposition header
    - _Requirements: 1.1, 1.2, 2.1_
  - [ ] 7.2 Add POST /api/backup/import-all endpoint
    - Accept backup JSON and options in request body
    - Validate and import data
    - Return detailed results
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 7.3 Write unit tests for API endpoints
    - Test export endpoint with various category selections
    - Test import endpoint with valid and invalid data
    - _Requirements: 1.1, 7.1_

- [ ] 8. Update Settings UI
  - [ ] 8.1 Add comprehensive export button to settings page
    - Add "Export Semua Data" button
    - Add category checkboxes for selective export
    - _Requirements: 1.1, 2.1_
  - [ ] 8.2 Add comprehensive import functionality
    - Add file input for backup JSON
    - Add options for skip/overwrite duplicates
    - Display import results summary
    - _Requirements: 7.3, 7.4_
  - [ ] 8.3 Write unit tests for UI components
    - Test export button functionality
    - Test import form validation
    - _Requirements: 1.1, 7.1_

- [ ] 9. Implement round-trip property test
  - [ ] 9.1 Write property test for round-trip consistency
    - **Property 1: Round-trip consistency for all categories**
    - Generate random valid data for all categories
    - Export, import to new context, compare values
    - **Validates: Requirements 8.1**

- [ ] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
