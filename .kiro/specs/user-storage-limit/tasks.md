# Implementation Plan

- [x] 1. Database schema updates




  - [x] 1.1 Add storage_limit column to users table


    - Add migration in db/database.js to add storage_limit INTEGER DEFAULT NULL




    - _Requirements: 1.2, 1.3_
  - [x] 1.2 Add default_storage_limit to system_settings


    - Insert default value in system_settings table
    - _Requirements: 5.1, 5.2_



- [ ] 2. Create StorageService
  - [ ] 2.1 Implement calculateUsage method
    - Query videos and audios tables to sum file_size by user_id
    - Return totalBytes, videoBytes, audioBytes
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Write property test for storage usage calculation

    - **Property 2: Storage Usage Calculation Accuracy**
    - **Validates: Requirements 2.1, 2.2**

  - [ ] 2.3 Implement formatBytes utility method
    - Convert bytes to human-readable format (KB, MB, GB, TB)
    - _Requirements: 2.3_
  - [ ] 2.4 Write property test for bytes formatting
    - **Property 7: Bytes Formatting Round Trip**

    - **Validates: Requirements 2.3**
  - [x] 2.5 Implement canUpload method





    - Check if user has storage limit


    - Calculate if upload would exceed limit
    - Return allowed, currentUsage, limit, remaining
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 2.6 Write property test for unlimited storage behavior
    - **Property 3: Unlimited Storage Behavior**

    - **Validates: Requirements 1.3, 4.4**
  - [x] 2.7 Write property test for storage limit enforcement

    - **Property 4: Storage Limit Enforcement**


    - **Validates: Requirements 1.4, 4.1, 4.2**




  - [ ] 2.8 Implement getStorageInfo method
    - Return usage, limit, percentage, formatted values, status
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 2.9 Write property test for percentage and status calculation


    - **Property 5: Percentage and Status Calculation**


    - **Validates: Requirements 3.2, 3.3, 3.4**





- [x] 3. Extend User model

  - [ ] 3.1 Add updateStorageLimit method
    - Update storage_limit column for user
    - Validate limit is positive integer or null
    - _Requirements: 1.2_

  - [ ] 3.2 Write property test for storage limit persistence
    - **Property 1: Storage Limit Persistence**
    - **Validates: Requirements 1.2**





  - [-] 3.3 Add getStorageLimit method



    - Query storage_limit from users table
    - _Requirements: 1.2_


  - [x] 3.4 Update User.create to apply default storage limit


    - Get default_storage_limit from system_settings
    - Apply to new user if configured



    - _Requirements: 5.1, 5.3_
  - [ ] 3.5 Write property test for default storage limit application
    - **Property 6: Default Storage Limit Application**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create upload middleware for storage validation
  - [ ] 5.1 Implement checkStorageLimit middleware
    - Get user from request
    - Call StorageService.canUpload with file size
    - Reject with 413 if limit exceeded
    - Include usage and limit info in error response
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 5.2 Integrate middleware with video upload route
    - Add checkStorageLimit before uploadVideo middleware
    - _Requirements: 4.1_
  - [ ] 5.3 Integrate middleware with audio upload route
    - Add checkStorageLimit before uploadAudio middleware
    - _Requirements: 4.1_

- [ ] 6. Create API endpoints
  - [ ] 6.1 Implement GET /api/users/:id/storage endpoint
    - Return storage info using StorageService.getStorageInfo
    - _Requirements: 1.1, 3.2_
  - [ ] 6.2 Implement PUT /api/users/:id/storage-limit endpoint
    - Validate admin role
    - Update storage limit using User.updateStorageLimit
    - _Requirements: 1.2_
  - [ ] 6.3 Implement GET /api/settings/default-storage-limit endpoint
    - Return default storage limit from system_settings
    - _Requirements: 5.2_
  - [ ] 6.4 Implement PUT /api/settings/default-storage-limit endpoint
    - Validate admin role
    - Update default_storage_limit in system_settings
    - _Requirements: 5.2_

- [ ] 7. Update UI components
  - [ ] 7.1 Add storage limit field to user management page
    - Display current limit and usage for each user
    - Add input field to set/update limit
    - _Requirements: 1.1_
  - [ ] 7.2 Add storage usage display to gallery page
    - Show usage bar with percentage
    - Display warning/critical indicators
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 7.3 Add default storage limit setting to settings page
    - Add input field for default limit
    - _Requirements: 5.2_
  - [ ] 7.4 Add storage limit error handling to upload forms
    - Display clear error message when upload rejected
    - Show current usage and limit
    - _Requirements: 4.3_

- [ ] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
