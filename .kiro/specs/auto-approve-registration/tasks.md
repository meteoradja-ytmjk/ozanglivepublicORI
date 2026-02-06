# Implementation Plan

- [x] 1. Extend SystemSettings Model




  - [ ] 1.1 Add getAutoApproveRegistration() method to return boolean
    - Return false if setting doesn't exist (default)

    - Return true only if value is "enabled"
    - _Requirements: 3.1, 3.2_

  - [ ] 1.2 Add setAutoApproveRegistration(enabled) method
    - Save "enabled" or "disabled" string to database
    - _Requirements: 1.2, 1.3_

  - [ ] 1.3 Add getDefaultLiveLimitForRegistration() method
    - Return 0 if setting doesn't exist (default unlimited)


    - Parse and return integer value

    - _Requirements: 3.3, 3.4_





  - [ ] 1.4 Add setDefaultLiveLimitForRegistration(limit) method
    - Validate and save limit value

    - _Requirements: 1.6, 1.7_
  - [ ] 1.5 Write property test for auto-approve setting persistence
    - **Property 1: Auto-approve setting persistence**

    - **Validates: Requirements 1.2, 1.3**
  - [ ] 1.6 Write property test for default values
    - **Property 4: Default values on fresh system**

    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 2. Create API Endpoints




  - [ ] 2.1 Add GET /api/settings/auto-approve endpoint
    - Return current auto-approve setting

    - Admin only access
    - _Requirements: 1.1_
  - [ ] 2.2 Add POST /api/settings/auto-approve endpoint
    - Update auto-approve setting

    - Admin only access with CSRF protection
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ] 2.3 Add GET /api/settings/default-live-limit-registration endpoint
    - Return current default live limit for registration




    - Admin only access
    - _Requirements: 1.5_

  - [ ] 2.4 Add POST /api/settings/default-live-limit-registration endpoint
    - Update default live limit for registration
    - Admin only access with CSRF protection

    - _Requirements: 1.6, 1.7, 1.8_

- [x] 3. Update Settings UI


  - [x] 3.1 Add User Registration Settings section in System tab

    - Add auto-approve toggle with label and description




    - Add default live limit input with save button
    - _Requirements: 1.1, 1.5_
  - [ ] 3.2 Add JavaScript for auto-approve toggle
    - Load current setting on page load
    - Save setting on toggle change
    - Show success/error toast
    - _Requirements: 1.4_
  - [ ] 3.3 Add JavaScript for default live limit
    - Load current setting on page load
    - Save setting on button click
    - Show success/error toast
    - _Requirements: 1.8_

- [ ] 4. Modify Signup Endpoint
  - [ ] 4.1 Update POST /signup to read auto-approve setting
    - Get auto-approve setting from SystemSettings
    - Set user status based on setting
    - _Requirements: 2.1, 2.2_
  - [ ] 4.2 Update POST /signup to apply default live limit
    - Get default live limit from SystemSettings
    - Set user live_limit (NULL if 0, otherwise the number)
    - _Requirements: 2.5, 2.6_
  - [ ] 4.3 Update success message based on auto-approve setting
    - Show immediate access message if auto-approve enabled
    - Show waiting for approval message if disabled
    - _Requirements: 2.3, 2.4_
  - [ ] 4.4 Write property test for user status matching auto-approve
    - **Property 2: User status matches auto-approve setting**
    - **Validates: Requirements 2.1, 2.2**
  - [ ] 4.5 Write property test for live limit application
    - **Property 3: Default live limit application**
    - **Validates: Requirements 2.5, 2.6**

- [ ] 5. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
