# Implementation Plan

- [x] 1. Database schema updates




  - [x] 1.1 Create system_settings table in database.js

    - Add CREATE TABLE statement for system_settings with key, value, updated_at columns
    - _Requirements: 1.2, 1.3_




  - [ ] 1.2 Add live_limit column to users table
    - Add ALTER TABLE statement to add live_limit INTEGER DEFAULT NULL


    - _Requirements: 2.2, 2.3_





- [x] 2. Create SystemSettings model




  - [ ] 2.1 Create models/SystemSettings.js with CRUD operations
    - Implement get(key), set(key, value), getDefaultLiveLimit() methods
    - Default live limit should return 1 if not configured
    - _Requirements: 1.2, 1.3_

  - [ ] 2.2 Write property test for settings round trip
    - **Property 1: Settings Round Trip**

    - **Validates: Requirements 1.2**


- [ ] 3. Update User model for live limit
  - [x] 3.1 Add updateLiveLimit and getLiveLimit methods to User model


    - updateLiveLimit(userId, limit) - update user's custom limit



    - getLiveLimit(userId) - get user's custom limit (null if not set)

    - _Requirements: 2.2, 2.3_





- [x] 4. Create LiveLimitService

  - [ ] 4.1 Create services/liveLimitService.js
    - Implement getEffectiveLimit(userId) - returns custom limit or default
    - Implement countActiveStreams(userId) - count streams with status 'live'
    - Implement canStartStream(userId) - returns boolean



    - Implement validateAndGetInfo(userId) - returns full info object

    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 4.2 Write property test for custom limit priority
    - **Property 2: Custom Limit Priority**



    - **Validates: Requirements 2.2, 3.4**

  - [x] 4.3 Write property test for live limit validation



    - **Property 3: Live Limit Validation**

    - **Validates: Requirements 3.1, 3.2, 3.3**



  - [-] 4.4 Write property test for active stream count accuracy

    - **Property 4: Active Stream Count Accuracy**



    - **Validates: Requirements 3.1**

- [ ] 5. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate validation into streaming service
  - [ ] 6.1 Update streamingService.js to check live limit before starting stream
    - Call LiveLimitService.canStartStream before starting
    - Return error message "Batas live streaming tercapai. Hubungi Admin untuk menambah limit." if limit reached
    - _Requirements: 3.2, 4.3_

- [ ] 7. Create API endpoints for admin settings
  - [ ] 7.1 Add GET /api/settings/live-limit endpoint in app.js
    - Return current default live limit
    - Require admin authentication
    - _Requirements: 1.1_
  - [ ] 7.2 Add POST /api/settings/live-limit endpoint in app.js
    - Accept and validate limit value (must be >= 1)
    - Save to system_settings table
    - Require admin authentication
    - _Requirements: 1.2_

- [ ] 8. Update user management API
  - [ ] 8.1 Update POST /api/users/update to handle live_limit field
    - Accept live_limit in request body
    - Save to user's live_limit column
    - _Requirements: 2.2_
  - [ ] 8.2 Add GET /api/streams/limit-info endpoint
    - Return user's effective limit, active stream count, and canStart status
    - _Requirements: 4.1_

- [ ] 9. Update settings page UI for admin
  - [ ] 9.1 Add live limit input field to views/settings.ejs
    - Add input field for default live limit with minimum value 1
    - Add save button and JavaScript to call API
    - _Requirements: 1.1_

- [ ] 10. Update user management UI
  - [ ] 10.1 Add live limit field to edit user modal in views/users.ejs
    - Add input field for custom live limit (0 or empty = use default)
    - Display current effective limit in user table
    - _Requirements: 2.1, 2.4_

- [ ] 11. Update dashboard UI for member
  - [ ] 11.1 Add live limit info display to views/dashboard.ejs
    - Show current active streams count and limit
    - Show visual indicator when limit is reached
    - _Requirements: 4.1, 4.2_

- [ ] 12. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
