# Implementation Plan

- [x] 1. Create database table for playlist audios




  - [ ] 1.1 Add `playlist_audios` table creation in `db/database.js`
    - Create table with id, playlist_id, audio_id, position, created_at
    - Add foreign key constraints with ON DELETE CASCADE




    - Add table to REQUIRED_TABLES array
    - _Requirements: 4.1_





- [x] 2. Update Playlist model for audio support


  - [ ] 2.1 Add `findByIdWithMedia` method to return playlist with videos and audios
    - Query playlist_audios table joined with audios
    - Return both videos and audios arrays
    - _Requirements: 4.2_




  - [ ] 2.2 Add `addAudio`, `removeAudio`, `updateAudioPositions` methods
    - Implement similar to existing video methods


    - _Requirements: 4.1_


  - [x] 2.3 Update `findAll` to include audio_count




    - Add COUNT for playlist_audios in the query
    - _Requirements: 5.1, 5.2_




  - [ ] 2.4 Write property test for audio persistence round trip
    - **Property 4: Audio Persistence Round Trip**

    - **Validates: Requirements 4.1, 4.2**

- [ ] 3. Update API endpoints for audio support
  - [x] 3.1 Update POST `/api/playlists` to accept and save audios array

    - Parse audios from request body
    - Call addAudio for each audio with position
    - _Requirements: 4.1_

  - [ ] 3.2 Update PUT `/api/playlists/:id` to handle audios
    - Clear existing audios and add new ones
    - _Requirements: 4.1_

  - [ ] 3.3 Update GET `/api/playlists/:id` to return audios
    - Use findByIdWithMedia instead of findByIdWithVideos
    - _Requirements: 4.2_


- [x] 4. Update playlist view to pass audios data


  - [ ] 4.1 Update playlist route to fetch and pass audios to view
    - Query Audio.findAll for user's audios



    - Pass audios array to EJS template


    - _Requirements: 1.1, 1.3_


- [ ] 5. Implement tab UI for available media (left column)
  - [ ] 5.1 Add tab buttons for Videos and Audios in playlist modal
    - Create tab header with two buttons


    - Style active/inactive states
    - _Requirements: 1.1_

  - [x] 5.2 Create available audios list container

    - Similar structure to available videos
    - Include search input for audios
    - Display audio title and duration
    - _Requirements: 1.3, 1.4_
  - [ ] 5.3 Implement tab switching logic for available media
    - Show/hide appropriate content on tab click
    - Maintain search state per tab




    - _Requirements: 1.2, 1.3_





- [ ] 6. Implement tab UI for selected media (right column)
  - [x] 6.1 Add tab buttons for Playlist Videos and Playlist Audios




    - Create tab header with two buttons
    - Style active/inactive states







    - _Requirements: 2.1_
  - [ ] 6.2 Create selected audios list container
    - Similar structure to selected videos
    - Include drag handle, title, duration, remove button
    - Show empty state when no audios selected
    - _Requirements: 2.3, 2.4_
  - [ ] 6.3 Implement tab switching logic for selected media
    - Show/hide appropriate content on tab click
    - _Requirements: 2.2, 2.3_

- [ ] 7. Implement audio selection JavaScript logic
  - [ ] 7.1 Add selectedAudios array and allAudios data
    - Initialize from EJS template data
    - _Requirements: 3.1_
  - [ ] 7.2 Implement addAudioToPlaylist and removeAudioFromPlaylist functions
    - Add/remove from selectedAudios array
    - Update both available and selected displays
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 7.3 Implement updateSelectedAudiosDisplay and updateAvailableAudiosDisplay
    - Render audio items with proper formatting
    - Handle empty states
    - _Requirements: 2.4_
  - [ ] 7.4 Implement audio search functionality
    - Filter available audios by title
    - _Requirements: 1.4_
  - [ ] 7.5 Initialize drag-and-drop for selected audios
    - Use Sortable.js for reordering
    - Update selectedAudios array on reorder
    - _Requirements: 3.5_
  - [ ] 7.6 Write property tests for audio selection logic
    - **Property 1: Audio Selection Moves Audio Between Lists**
    - **Property 2: Audio Removal Returns Audio to Available List**
    - **Property 3: Audio Reorder Preserves All Audios**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 8. Update form submission to include audios
  - [ ] 8.1 Modify playlist form submit handler
    - Include audios array in request body
    - Map selectedAudios to IDs
    - _Requirements: 4.1_

- [ ] 9. Update edit playlist to load existing audios
  - [ ] 9.1 Modify editPlaylist function to populate selectedAudios
    - Load audios from API response
    - Update displays for both tabs
    - _Requirements: 4.2_

- [ ] 10. Update view playlist modal to show audios
  - [ ] 10.1 Add audios section in view playlist modal
    - Display audios with index, title, duration
    - Show appropriate empty state if no audios
    - _Requirements: 4.3_

- [ ] 11. Update playlist card to show audio count
  - [ ] 11.1 Modify playlist card template to display audio count
    - Add audio count with music icon
    - Show alongside video count
    - _Requirements: 5.1, 5.2_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
