# Implementation Plan

- [x] 1. Add Audio Selector to Stream Modal





  - [ ] 1.1 Add audio selector HTML structure in dashboard.ejs
    - Add dropdown button below video selector


    - Add search input and audio list container
    - Add hidden input for selectedAudioId
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Implement audio selector JavaScript functions in stream-modal.js


    - Add toggleAudioSelector() function
    - Add selectAudio(audio) function

    - Add clearAudioSelection() function
    - Add selectedAudioData variable
    - _Requirements: 1.3, 1.4_
  - [x] 1.3 Create API endpoint for fetching audio list


    - Add GET /api/stream/audios endpoint in app.js

    - Return audio list with id, name, duration, format, filepath
    - _Requirements: 1.2_
  - [-] 1.4 Implement audio loading and search functionality


    - Add loadGalleryAudios() function
    - Add handleAudioSearch() function
    - Add displayFilteredAudios() function
    - _Requirements: 1.2, 1.5_

  - [ ] 1.5 Write property test for audio search filter
    - **Property 1: Audio search filter correctness**
    - **Validates: Requirements 1.5**


- [ ] 2. Add Duration Selector to Schedule Settings
  - [ ] 2.1 Add duration selector HTML in dashboard.ejs
    - Add select dropdown with duration options (1-24 hours, Custom, No limit)
    - Add hidden custom duration input field
    - Place in Schedule Settings section




    - _Requirements: 2.1, 2.2_
  - [ ] 2.2 Implement duration handling JavaScript functions
    - Add handleDurationChange() function

    - Add calculateEndTime() function
    - Add updateEndTimeField() function




    - Show/hide custom input based on selection
    - _Requirements: 2.3, 2.4, 2.5_
  - [x] 2.3 Write property test for end time calculation

    - **Property 2: End time calculation correctness**
    - **Validates: Requirements 2.5**





- [ ] 3. Simplify Stream Configuration
  - [ ] 3.1 Update RTMP URL with YouTube default
    - Set default value to rtmp://a.rtmp.youtube.com/live2




    - Remove platform selector dropdown
    - _Requirements: 4.1, 4.3_
  - [ ] 3.2 Reorganize RTMP URL and Stream Key layout
    - Display in compact single-row layout
    - Remove unnecessary icons and labels
    - _Requirements: 4.2_

- [ ] 4. Remove Advanced Settings
  - [ ] 4.1 Remove Advanced Settings HTML from dashboard.ejs
    - Delete Advanced Settings toggle button
    - Delete Advanced Settings content section
    - _Requirements: 3.1_
  - [ ] 4.2 Remove Advanced Settings JavaScript from stream-modal.js
    - Remove toggleAdvancedSettings() function
    - Remove related event listeners
    - Remove Twitch-related code
    - _Requirements: 3.1, 3.3_

- [ ] 5. Update Form Submission
  - [ ] 5.1 Update form data to include audio and duration
    - Add audioId to form submission
    - Add duration to form submission
    - Update stream creation API to handle new fields
    - _Requirements: 1.4, 2.3_
  - [ ] 5.2 Update resetModalForm() function
    - Reset audio selection state
    - Reset duration selection
    - Clear custom duration input
    - _Requirements: 3.2_

- [ ] 6. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
