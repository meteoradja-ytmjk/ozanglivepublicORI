# Implementation Plan

- [x] 1. Remove Category field from broadcast forms

  - [x] 1.1 Remove category field from Create Broadcast Modal in views/youtube.ejs
    - Remove the category select element and its label
    - Remove categoryAutoFillIndicator element
    - Keep default category value (20 - Gaming) in backend logic
    - _Requirements: 3.1_

  - [x] 1.2 Remove category field from Edit Broadcast Modal in views/youtube.ejs
    - Remove category select if present in edit modal
    - _Requirements: 3.2_

  - [x] 1.3 Remove category field from Create Template Modal in views/youtube.ejs
    - Remove category select from template creation form
    - _Requirements: 3.1_

  - [x] 1.4 Update backend to use default category value
    - Ensure createBroadcast API uses default categoryId "20" when not provided
    - _Requirements: 3.3_

  - [x] 1.5 Write property test for category field removal
    - **Property 6: Category field removal**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. Enhance auto-fill functionality for channel defaults

  - [x] 2.1 Update fetchChannelDefaults function in public/js/youtube.js
    - Add loading indicator toggle for title, description, and tags fields
    - Ensure function is called on modal open and account change
    - _Requirements: 1.1, 1.5, 5.1_

  - [x] 2.2 Update populateFormWithDefaults function in public/js/youtube.js
    - Populate title field if default title is available
    - Populate description field if default description is available
    - Populate tags field if default tags array is available
    - Show auto-fill indicators for populated fields
    - _Requirements: 1.2, 1.3, 1.4, 1.6_

  - [x] 2.3 Add auto-fill indicators to form fields in views/youtube.ejs
    - Add titleAutoFillIndicator element next to title label
    - Add descriptionAutoFillIndicator element next to description label
    - Ensure tagsAutoFillIndicator is properly styled
    - _Requirements: 1.6_

  - [x] 2.4 Handle API failure gracefully
    - On fetch failure, allow manual input without blocking
    - Hide auto-fill indicators on failure
    - Show toast notification for user feedback
    - _Requirements: 1.7_

  - [x] 2.5 Write property test for form population from channel defaults
    - **Property 1: Form population from channel defaults**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 2.6 Write property test for loading indicator visibility
    - **Property 2: Loading indicator visibility during data fetch**
    - **Validates: Requirements 1.5, 2.2, 5.3**

  - [x] 2.7 Write property test for auto-fill indicator display
    - **Property 3: Auto-fill indicator display**
    - **Validates: Requirements 1.6, 4.2**

  - [x] 2.8 Write property test for form functionality on API failure
    - **Property 4: Form remains functional on API failure**
    - **Validates: Requirements 1.7, 2.6**

- [x] 3. Enhance stream key loading functionality

  - [x] 3.1 Update fetchStreams function in public/js/youtube.js
    - Ensure loading spinner is displayed during fetch
    - Handle empty stream keys response
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 3.2 Update stream key dropdown display format
    - Show stream title, resolution, and frame rate in option text
    - Format: "{title} ({resolution} @ {frameRate})"
    - _Requirements: 2.4_

  - [x] 3.3 Handle stream key fetch failure
    - Display "Create new stream key" as only option on failure
    - Allow form submission to continue
    - _Requirements: 2.6_

  - [x] 3.4 Write property test for stream key dropdown population
    - **Property 5: Stream key dropdown population**
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Implement account change handler

  - [x] 4.1 Update onAccountChange function in public/js/youtube.js
    - Fetch channel defaults for new account
    - Fetch stream keys for new account
    - Show loading indicators during fetch
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Update auto-filled fields on account change
    - Clear previous auto-fill indicators
    - Populate fields with new account's defaults
    - Update stream key dropdown with new account's streams
    - _Requirements: 5.4_

  - [x] 4.3 Write property test for account change data refresh
    - **Property 9: Account change triggers data refresh**
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 5. Ensure mobile-desktop UI consistency

  - [x] 5.1 Verify form field order consistency
    - Ensure Create Broadcast Modal has same field order on mobile and desktop
    - Fields order: Account, Title, Description, Scheduled Time, Privacy, Stream Key, Tags, Thumbnail
    - _Requirements: 4.1_

  - [x] 5.2 Ensure auto-fill indicators are visible on mobile
    - Verify indicator styling works on small screens
    - _Requirements: 4.2_

  - [x] 5.3 Ensure stream key dropdown has same options on mobile
    - Verify dropdown renders correctly on mobile
    - _Requirements: 4.3_

  - [x] 5.4 Ensure touch-friendly input sizes
    - Set minimum height of 44px for all form inputs
    - Set minimum touch target of 44px for buttons
    - _Requirements: 4.4_

  - [x] 5.5 Ensure modal is scrollable on mobile
    - Add overflow-y-auto to modal container
    - Test scrolling on small viewport
    - _Requirements: 4.5_

  - [x] 5.6 Write property test for mobile-desktop UI consistency
    - **Property 7: Mobile-desktop UI consistency**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 5.7 Write property test for touch-friendly input sizes
    - **Property 8: Touch-friendly input sizes**
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint - Ensure all tests pass
  - All 26 tests passing ✓

- [x] 7. Final integration and cleanup

  - [x] 7.1 Remove unused category-related code
    - Remove category handling from JavaScript if not needed
    - Clean up any orphaned category references
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Test complete flow end-to-end
    - Open create broadcast modal
    - Verify auto-fill works
    - Change account and verify refresh
    - Submit form and verify broadcast creation
    - _Requirements: 1.1, 2.1, 5.1_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - All 26 tests passing ✓
