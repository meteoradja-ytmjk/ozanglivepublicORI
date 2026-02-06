# Implementation Plan

## Tasks

- [x] 1. Fix duration update in backend API

  - [x] 1.1 Add stream_duration_hours handling to PUT /api/streams/:id endpoint


    - Locate the PUT endpoint in app.js (around line 1798)
    - Add code to extract and parse streamDuration from req.body
    - Add stream_duration_hours to updateData object
    - Handle empty/null values correctly


    - _Requirements: 1.1, 1.3_

  - [ ] 1.2 Write property test for duration update round trip
    - **Property 1: Duration update round trip**
    - **Validates: Requirements 1.1**



- [x] 2. Fix icon visibility for dynamically rendered content

  - [ ] 2.1 Add font-loaded class to dynamically rendered icons in dashboard.ejs
    - Locate renderStreams() function in dashboard.ejs
    - Add code to apply font-loaded class to all .ti elements after render
    - Ensure both desktop table and mobile list icons get the class
    - _Requirements: 2.1, 2.3, 3.2_
  - [x] 2.2 Write property test for icon class application




    - **Property 2: Icon font-loaded class application**


    - **Validates: Requirements 2.1, 3.2**

- [ ] 3. Ensure audio selection is preserved during edit
  - [ ] 3.1 Add audio_id handling to PUT endpoint and edit modal
    - Add audio_id to updateData in PUT endpoint if provided
    - Update editStream() function to load and display selected audio
    - _Requirements: 1.2_

- [ ] 4. Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
