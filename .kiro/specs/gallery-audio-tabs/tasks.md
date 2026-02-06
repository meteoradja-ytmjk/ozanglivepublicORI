# Implementation Plan

## 1. Database and Model Setup

- [x] 1.1 Create audio table in database
  - Add `audios` table creation in `db/database.js`
  - Include all fields: id, title, filepath, file_size, duration, format, user_id, upload_date, created_at, updated_at
  - _Requirements: 1.2_

- [x] 1.2 Create Audio model (`models/Audio.js`)
  - Implement `create()` method for inserting audio records
  - Implement `findById()` method
  - Implement `findAll(userId)` method with ordering by upload_date DESC
  - Implement `update()` method for renaming
  - Implement `delete()` method that removes both database record and file
  - _Requirements: 1.2, 5.2, 5.4_

- [ ]* 1.3 Write property test for audio deletion completeness
  - **Property 7: Audio deletion completeness**
  - **Validates: Requirements 5.4**

## 2. Upload Middleware and Storage

- [x] 2.1 Extend storage utilities
  - Add `audios` path to `utils/storage.js`
  - Update `ensureDirectories()` to create audio upload folder
  - _Requirements: 1.1_

- [x] 2.2 Create audio upload middleware
  - Add `audioStorage` configuration in `middleware/uploadMiddleware.js`
  - Implement `audioFilter` for MP3, WAV, AAC validation
  - Export `uploadAudio` multer instance
  - _Requirements: 1.1, 1.3_

- [ ]* 2.3 Write property test for invalid audio format rejection
  - **Property 2: Invalid audio format rejection**
  - **Validates: Requirements 1.3**

## 3. Audio API Routes

- [x] 3.1 Create audio upload endpoint
  - Add `POST /api/audios/upload` route in `app.js`
  - Extract audio metadata (duration, format) using ffprobe
  - Save audio record to database
  - Return success response with audio data
  - _Requirements: 1.2, 1.4_

- [ ]* 3.2 Write property test for audio metadata storage
  - **Property 1: Audio metadata storage completeness**
  - **Validates: Requirements 1.2**

- [x] 3.3 Create audio rename endpoint
  - Add `POST /api/audios/:id/rename` route
  - Validate ownership and update title
  - _Requirements: 5.2_

- [ ]* 3.4 Write property test for audio rename persistence
  - **Property 6: Audio rename persistence**
  - **Validates: Requirements 5.2**

- [x] 3.5 Create audio delete endpoint
  - Add `DELETE /api/audios/:id` route
  - Validate ownership and delete record + file
  - _Requirements: 5.4_

- [x] 3.6 Create audio streaming endpoint
  - Add `GET /stream/audio/:id` route
  - Stream audio file with proper content-type headers
  - _Requirements: 4.1_

## 4. Checkpoint - Backend Complete

- [ ] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 5. Gallery View with Tabs

- [x] 5.1 Update gallery route for tab support
  - Modify `GET /gallery` route to accept `tab` query parameter
  - Fetch both videos and audios based on user
  - Pass tab state and media data to view
  - _Requirements: 2.1, 2.4, 2.5_

- [ ]* 5.2 Write property test for URL tab parameter activation
  - **Property 4: URL tab parameter activation**
  - **Validates: Requirements 2.5**

- [x] 5.3 Create tab navigation UI
  - Add tab buttons (Videos, Audio) to `views/gallery.ejs`
  - Style active/inactive tab states
  - Implement tab click handlers with URL update
  - _Requirements: 2.1, 2.2, 2.3_

- [ ]* 5.4 Write property test for tab-based media filtering
  - **Property 3: Tab-based media filtering**
  - **Validates: Requirements 2.2, 2.3**

## 6. Audio Display Components

- [x] 6.1 Create audio card component
  - Add audio card HTML template in gallery view
  - Display title, duration, file size, upload date
  - Add default audio icon
  - Add play button overlay on hover
  - Add rename and delete action buttons
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]* 6.2 Write property test for audio card information display
  - **Property 5: Audio card information display**
  - **Validates: Requirements 3.1**

- [x] 6.3 Create audio grid section
  - Add conditional rendering for audio tab content
  - Display audio cards in grid layout
  - Show empty state when no audio files
  - _Requirements: 2.3, 3.1_

## 7. Audio Upload Modal

- [x] 7.1 Create audio upload modal
  - Add modal HTML structure similar to video upload modal
  - Configure file input for audio formats (MP3, WAV, AAC)
  - Add drag and drop support
  - _Requirements: 1.1_

- [x] 7.2 Implement audio upload JavaScript
  - Add `openAudioUploadModal()` and `closeAudioUploadModal()` functions
  - Implement file selection and validation
  - Add upload progress tracking
  - Handle success/error responses
  - _Requirements: 1.1, 1.3, 1.4_

## 8. Audio Player Modal

- [x] 8.1 Create audio player modal
  - Add modal HTML with audio element
  - Include native audio controls
  - Display audio title
  - Add close button
  - _Requirements: 4.1, 4.2_

- [x] 8.2 Implement audio player JavaScript
  - Add `playAudio(audioId, audioTitle)` function
  - Handle modal open/close
  - Stop playback on modal close
  - _Requirements: 4.1, 4.2, 4.3_

## 9. Audio Management Functions

- [x] 9.1 Implement audio rename functionality
  - Add `showRenameAudioDialog()` function
  - Call rename API endpoint
  - Update UI on success
  - _Requirements: 5.1, 5.2_

- [x] 9.2 Implement audio delete functionality
  - Add `showDeleteAudioDialog()` function
  - Show confirmation dialog
  - Call delete API endpoint
  - Remove card from UI on success
  - _Requirements: 5.3, 5.4_

## 10. Search and Sort for Audio

- [x] 10.1 Implement audio search
  - Add search input handler for audio tab
  - Filter audio cards by title
  - _Requirements: 6.1_

- [ ]* 10.2 Write property test for audio search filtering
  - **Property 8: Audio search filtering**
  - **Validates: Requirements 6.1**

- [x] 10.3 Implement audio sort
  - Add sort dropdown handler for audio tab
  - Reorder audio cards by upload date
  - _Requirements: 6.2_

- [ ]* 10.4 Write property test for audio sort ordering
  - **Property 9: Audio sort ordering**
  - **Validates: Requirements 6.2**

## 11. Final Checkpoint

- [ ] 11. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
