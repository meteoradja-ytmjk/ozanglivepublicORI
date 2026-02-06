# Implementation Plan

- [-] 1. Implement Inline Edit for Duration Column



  - [ ] 1.1 Create inline edit function for duration cell
    - Add `createDurationInlineEdit(streamId, currentValue)` function
    - Create input element with number type and validation
    - Handle blur and Enter key events to save
    - Handle Escape key to cancel
    - _Requirements: 1.2, 1.4, 1.6_
  - [x] 1.2 Write property test for duration inline save

    - **Property 1: Inline edit save triggers API call with correct data**
    - **Validates: Requirements 1.4**
  - [ ] 1.3 Update renderStreams() to make duration cell clickable
    - Add onclick handler to duration cell


    - Call createDurationInlineEdit on click
    - _Requirements: 1.2_

- [ ] 2. Implement Inline Edit for Schedule Column
  - [ ] 2.1 Create inline edit function for schedule cell
    - Add `createScheduleInlineEdit(streamId, currentSchedule)` function
    - Create dropdown for schedule type (once/daily/weekly)
    - Create time input for recurring_time
    - Handle blur and Enter key events to save

    - Handle Escape key to cancel
    - _Requirements: 1.1, 1.3, 1.6_
  - [ ] 2.2 Write property test for schedule inline save
    - **Property 1: Inline edit save triggers API call with correct data**

    - **Validates: Requirements 1.3**

  - [ ] 2.3 Update renderStreams() to make schedule cell clickable
    - Add onclick handler to schedule cell
    - Call createScheduleInlineEdit on click
    - _Requirements: 1.1_

- [ ] 3. Implement Inline Edit Error Handling and Cancel
  - [ ] 3.1 Add error handling for inline edit save
    - Implement revert to original value on API failure
    - Show error toast notification
    - _Requirements: 1.5_
  - [ ] 3.2 Write property test for failed edit revert
    - **Property 2: Failed inline edit reverts to original value**

    - **Validates: Requirements 1.5**

  - [ ] 3.3 Write property test for escape cancel
    - **Property 3: Escape key cancels inline edit**
    - **Validates: Requirements 1.6**

- [ ] 4. Checkpoint - Ensure inline edit tests pass
  - Ensure all tests pass, ask the user if questions arise.



- [ ] 5. Remove Delete Confirmation Dialog
  - [ ] 5.1 Modify deleteStream() function to remove confirmation
    - Remove `confirm()` call from deleteStream function
    - Keep success/error notification handling

    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 5.2 Write property test for delete result handling
    - **Property 4: Delete operation result handling**
    - **Validates: Requirements 2.2, 2.3**

- [ ] 6. Implement Filter Dropdown for Stream Names
  - [x] 6.1 Create filter dropdown component

    - Add `generateFilterOptions(streams)` function to extract unique name prefixes
    - Create dropdown HTML element to replace search input
    - Style dropdown to match existing UI
    - _Requirements: 3.1_
  - [ ] 6.2 Implement filter logic
    - Add `filterStreams(streams, filterValue)` function
    - Update renderStreams to use filtered data
    - Add "All Streams" option as default
    - _Requirements: 3.2, 3.3_


  - [x] 6.3 Write property test for filter matching

    - **Property 5: Filter displays only matching streams**
    - **Validates: Requirements 3.2**
  - [ ] 6.4 Update filter options on stream changes
    - Call generateFilterOptions after loadStreams

    - Update dropdown options dynamically
    - _Requirements: 3.4_
  - [ ] 6.5 Write property test for filter options update
    - **Property 6: Filter options reflect current streams**

    - **Validates: Requirements 3.4**

- [ ] 7. Checkpoint - Ensure filter tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Delete All Feature in Backup Menu
  - [ ] 8.1 Add Delete All API endpoint
    - Create `DELETE /api/streams/all` endpoint in app.js
    - Return count of deleted streams
    - Handle errors appropriately
    - _Requirements: 4.2, 4.3_
  - [ ] 8.2 Add Delete All button to Backup dropdown menu
    - Add "Delete All" option in backupDropdownMenu (desktop)
    - Add "Delete All" option in backupDropdownMenuMobile (mobile)
    - Style with red color to indicate destructive action
    - _Requirements: 4.1_
  - [ ] 8.3 Implement deleteAllStreams() function
    - Call DELETE /api/streams/all endpoint
    - Show success notification with count
    - Refresh stream list after deletion
    - Handle errors with error notification
    - _Requirements: 4.2, 4.3, 4.4_
  - [ ] 8.4 Write property test for delete all
    - **Property 7: Delete all removes all streams**
    - **Validates: Requirements 4.2**

- [ ] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
