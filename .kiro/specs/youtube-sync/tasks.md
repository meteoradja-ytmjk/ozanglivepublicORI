# Implementation Plan

- [x] 1. Setup database schema and model




  - [ ] 1.1 Create youtube_credentials table migration in database.js
    - Add table with columns: id, user_id, client_id, client_secret, refresh_token, channel_name, channel_id, created_at


    - Add foreign key constraint to users table


    - _Requirements: 1.3_




  - [ ] 1.2 Create YouTubeCredentials model (models/YouTubeCredentials.js)
    - Implement save(), findByUserId(), delete() methods
    - _Requirements: 1.3, 1.4_

  - [ ] 1.3 Write property test for credentials storage round-trip
    - **Property 2: Credentials storage**
    - **Validates: Requirements 1.3**


- [ ] 2. Implement YouTubeService
  - [x] 2.1 Create YouTubeService (services/youtubeService.js)


    - Implement getAccessToken() to exchange refresh token for access token

    - Implement validateCredentials() to test API connection
    - Implement getChannelInfo() to get channel name and ID




    - _Requirements: 1.2, 1.3_
  - [ ] 2.2 Add broadcast methods to YouTubeService
    - Implement createBroadcast() with title, description, scheduledStartTime, privacyStatus

    - Implement listBroadcasts() to fetch upcoming broadcasts
    - Implement deleteBroadcast() to delete a broadcast
    - _Requirements: 2.2, 3.1, 3.5_
  - [x] 2.3 Add thumbnail method to YouTubeService

    - Implement uploadThumbnail() to upload image to YouTube API
    - _Requirements: 2.3, 3.4_
  - [ ] 2.4 Write property test for credentials validation
    - **Property 1: Credentials validation**

    - **Validates: Requirements 1.2, 1.5**
  - [ ] 2.5 Write property test for broadcast creation returns stream key
    - **Property 4: Broadcast creation returns stream key**

    - **Validates: Requirements 2.2, 2.3**



- [x] 3. Implement API routes


  - [x] 3.1 Add credentials routes to app.js




    - POST /api/youtube/credentials - Save and validate credentials
    - GET /api/youtube/credentials - Check if credentials exist
    - DELETE /api/youtube/credentials - Remove credentials
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [ ] 3.2 Add broadcast routes to app.js
    - GET /api/youtube/broadcasts - List all broadcasts
    - POST /api/youtube/broadcasts - Create new broadcast with optional thumbnail

    - DELETE /api/youtube/broadcasts/:id - Delete broadcast
    - _Requirements: 2.1, 2.2, 3.1, 3.5_


  - [x] 3.3 Add thumbnail route to app.js




    - POST /api/youtube/broadcasts/:id/thumbnail - Upload/change thumbnail
    - Add multer middleware for image upload
    - Validate file type (JPG/PNG) and size (max 2MB)




    - _Requirements: 2.3, 2.7, 3.3, 3.4_
  - [ ] 3.4 Add scheduled time validation
    - Validate that scheduled start time is at least 10 minutes in the future
    - Return error if validation fails
    - _Requirements: 2.6_



  - [ ] 3.5 Write property test for scheduled time validation
    - **Property 5: Scheduled time validation**
    - **Validates: Requirements 2.6**
  - [ ] 3.6 Write property test for thumbnail validation
    - **Property 8: Thumbnail validation**
    - **Validates: Requirements 2.7**

- [ ] 4. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create YouTube Sync page view
  - [ ] 5.1 Create views/youtube.ejs
    - Add credentials form section (shown when not connected)
    - Add connected account info section (shown when connected)
    - Add create broadcast button and modal form
    - Add broadcasts list with cards showing title, time, privacy, stream key, thumbnail
    - Add change thumbnail button for each broadcast
    - Add delete button with confirmation for each broadcast
    - Add empty state message when no broadcasts
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 3.6_
  - [ ] 5.2 Add YouTube Sync page route to app.js
    - GET /youtube - Render youtube.ejs with credentials and broadcasts data
    - _Requirements: 4.2_
  - [ ] 5.3 Write property test for broadcast list display
    - **Property 6: Broadcast list contains required fields**
    - **Validates: Requirements 3.2**

- [ ] 6. Add sidebar menu item
  - [ ] 6.1 Update views/layout.ejs to add YouTube menu
    - Add YouTube icon menu item in desktop sidebar
    - Add YouTube icon menu item in mobile bottom navigation
    - Highlight active state when on /youtube page
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Add client-side JavaScript
  - [ ] 7.1 Create public/js/youtube.js
    - Add credentials form submission handler
    - Add create broadcast form submission handler with thumbnail upload
    - Add change thumbnail handler
    - Add delete broadcast handler with confirmation
    - Add copy stream key to clipboard functionality
    - _Requirements: 1.2, 2.1, 2.3, 3.3, 3.4, 3.5_

- [ ] 8. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
