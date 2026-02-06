# Implementation Plan

- [x] 1. Add listStreams method to YouTubeService




  - [ ] 1.1 Implement listStreams method in services/youtubeService.js
    - Call YouTube liveStreams.list API with part 'snippet,cdn'
    - Return array of stream objects with id, title, streamKey, rtmpUrl, resolution, frameRate
    - _Requirements: 1.1, 1.2_
  - [x]* 1.2 Write property test for listStreams




    - **Property 1: Stream list completeness**
    - **Validates: Requirements 1.1, 1.2**

- [ ] 2. Add API endpoint for fetching streams
  - [ ] 2.1 Add GET /api/youtube/streams endpoint in app.js
    - Authenticate user and get YouTube credentials
    - Call youtubeService.listStreams
    - Return JSON response with streams array




    - _Requirements: 1.1, 1.4_
  - [ ]* 2.2 Write unit test for streams endpoint
    - Test successful response with streams
    - Test empty streams response
    - Test error handling
    - _Requirements: 1.3, 1.4_





- [x] 3. Modify createBroadcast to support existing stream selection




  - [ ] 3.1 Update createBroadcast method in youtubeService.js
    - Accept optional streamId parameter
    - If streamId provided, skip liveStreams.insert and use existing stream


    - If streamId not provided, create new stream as before
    - _Requirements: 2.1, 2.2_
  - [ ]* 3.2 Write property test for createBroadcast with existing stream
    - **Property 2: Existing stream binding**

    - **Validates: Requirements 2.1, 2.3**

- [ ] 4. Update API endpoint to accept streamId
  - [ ] 4.1 Modify POST /api/youtube/broadcasts endpoint in app.js
    - Accept streamId in request body
    - Pass streamId to youtubeService.createBroadcast




    - _Requirements: 2.1, 2.2, 2.3_


- [ ] 5. Update frontend to show stream key selector
  - [ ] 5.1 Add stream key dropdown to create broadcast modal in views/youtube.ejs
    - Add select element with id="streamKeySelect"
    - Add loading state indicator
    - Add "Create new stream key" option as default

    - _Requirements: 1.2, 1.3, 3.1, 3.2_
  - [ ] 5.2 Add fetchStreams function in public/js/youtube.js
    - Fetch streams from /api/youtube/streams on modal open
    - Populate dropdown with stream options


    - Show title, resolution, and frame rate for each option
    - Handle loading and error states
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2_
  - [ ] 5.3 Update createBroadcastForm submit handler
    - Include selected streamId in form data



    - Send null if "Create new" is selected
    - _Requirements: 2.1, 2.2_
  - [ ]* 5.4 Write property test for stream dropdown rendering
    - **Property 3: Stream info display completeness**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 6. Add thumbnail gallery feature
  - [ ] 6.1 Add GET /api/thumbnails endpoint in app.js
    - Read files from public/uploads/thumbnails folder
    - Return array of thumbnail objects with filename and path
    - _Requirements: 4.1_
  - [ ] 6.2 Add thumbnail gallery UI to create broadcast modal in views/youtube.ejs
    - Add grid container for thumbnail gallery below existing thumbnail upload
    - Display thumbnails with click-to-select functionality
    - Add visual selection indicator (border highlight)
    - Keep existing upload button as alternative option
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 6.3 Add fetchThumbnails and thumbnail selection logic in public/js/youtube.js
    - Fetch thumbnails from /api/thumbnails on modal open
    - Handle thumbnail click to select
    - Update form submission to include selected thumbnail path
    - _Requirements: 4.1, 4.2, 4.5_
  - [ ] 6.4 Update POST /api/youtube/broadcasts to handle gallery thumbnail
    - Accept thumbnailPath parameter for gallery selection
    - Read file from path and upload to YouTube if provided
    - _Requirements: 4.5_
  - [ ]* 6.5 Write property test for thumbnail gallery
    - **Property 4: Thumbnail gallery completeness**
    - **Validates: Requirements 4.1**

- [ ] 7. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

