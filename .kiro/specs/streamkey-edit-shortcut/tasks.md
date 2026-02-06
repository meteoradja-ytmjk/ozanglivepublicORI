# Implementation Plan

- [x] 1. Create backend API endpoint for stream key lookup

  - [x] 1.1 Add `findByStreamKey` method to Stream model


    - Add static method to `models/Stream.js` that queries database by `stream_key`
    - Return stream object if found, null if not found


    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Write property test for stream key lookup
    - **Property 1: Stream Key Lookup Consistency**


    - **Validates: Requirements 1.1, 1.2**
  - [ ] 1.3 Write property test for non-existent stream key
    - **Property 2: Non-existent Stream Key Returns Null**

    - **Validates: Requirements 1.3**


  - [ ] 1.4 Add API route `GET /api/streams/by-stream-key/:streamKey`
    - Add route handler in `app.js`
    - Call `Stream.findByStreamKey` method


    - Return JSON response with success status and stream data
    - _Requirements: 1.1, 1.2, 1.3_



- [ ] 2. Update frontend to use edit shortcut
  - [ ] 2.1 Add `goToEditStream` function to `public/js/youtube.js`
    - Implement async function that calls API endpoint

    - Handle success: redirect to `/schedule?edit=streamId`


    - Handle error: show toast notification
    - _Requirements: 1.1, 1.2, 1.3_



  - [ ] 2.2 Update desktop view button in `views/youtube.ejs`
    - Change `onclick` from `copyStreamKey` to `goToEditStream`
    - Change icon from `ti-copy` to `ti-edit`
    - Change tooltip from "Copy Stream Key" to "Edit Stream Schedule"
    - _Requirements: 1.4, 1.5, 2.1, 2.2_
  - [ ] 2.3 Update mobile view button in `views/youtube.ejs`
    - Change `onclick` from `copyStreamKey` to `goToEditStream`
    - Change icon from `ti-copy` to `ti-edit`
    - Maintain 44x44 pixel minimum size for touch target
    - _Requirements: 1.4, 1.5, 2.1, 2.3_

- [ ] 3. Update Schedule page to handle edit parameter
  - [ ] 3.1 Add query parameter handling in Schedule page
    - Check for `edit` query parameter on page load
    - If present, call `editStream` function with the stream ID
    - _Requirements: 1.1, 1.2_

- [ ] 4. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
