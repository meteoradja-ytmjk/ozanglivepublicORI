# Implementation Plan

- [x] 1. Database schema migration for multiple YouTube accounts




  - [ ] 1.1 Create migration script to modify youtube_credentials table
    - Remove UNIQUE constraint on user_id
    - Add is_primary column with default 0
    - Add UNIQUE constraint on (user_id, channel_id)


    - Migrate existing data with is_primary = 1





    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Write property test for account preservation
    - **Property 1: Adding account preserves existing accounts**
    - **Validates: Requirements 1.2**



- [x] 2. Update YouTubeCredentials model for multiple accounts

  - [ ] 2.1 Add findAllByUserId method to return all credentials for a user
    - _Requirements: 1.4_



  - [ ] 2.2 Add findById method to get specific credential
    - _Requirements: 2.4, 3.1_

  - [ ] 2.3 Modify save method to create new records instead of update
    - Rename to create() for clarity

    - Add existsByChannel() to prevent duplicate channels
    - _Requirements: 1.1, 1.2_

  - [ ] 2.4 Add deleteById method to remove specific credential
    - _Requirements: 3.1, 3.4_

  - [ ] 2.5 Add setPrimary and getPrimary methods
    - _Requirements: 2.3_


  - [x] 2.6 Write property test for disconnect preserves other accounts


    - **Property 2: Disconnect removes only target account**




    - **Validates: Requirements 3.1, 3.4**

- [x] 3. Update API routes for multiple YouTube accounts

  - [ ] 3.1 Modify GET /youtube to fetch all connected accounts
    - Pass array of credentials to view
    - _Requirements: 1.4_
  - [x] 3.2 Modify POST /api/youtube/credentials to add new account

    - Check for duplicate channel before adding
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 3.3 Add DELETE /api/youtube/credentials/:id endpoint
    - Remove specific credential by ID

    - _Requirements: 3.1, 3.4_

  - [ ] 3.4 Add GET /api/youtube/accounts endpoint
    - Return list of connected accounts for dropdown

    - _Requirements: 2.1_
  - [x] 3.5 Modify broadcast endpoints to accept accountId parameter

    - Use specific account credentials for API calls
    - _Requirements: 2.4, 4.3_
  - [x] 3.6 Write property test for broadcast uses correct credentials

    - **Property 4: Broadcast uses selected account credentials**
    - **Validates: Requirements 2.4**


- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 5. Update YouTube page UI for multiple accounts
  - [x] 5.1 Modify youtube.ejs to display multiple connected accounts

    - Show list of account cards with channel name and disconnect button
    - Add "Add Account" button when accounts exist

    - Show connect form only when no accounts connected

    - _Requirements: 1.4, 3.3_
  - [x] 5.2 Add account selector dropdown to create broadcast modal

    - Load accounts on modal open

    - Auto-select if only one account
    - Update stream keys when account changes
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 5.3 Update broadcast list to show channel name badge

    - Display which account each broadcast belongs to
    - _Requirements: 4.1, 4.2_

  - [ ] 5.4 Write property test for all accounts displayed
    - **Property 3: All connected accounts are displayed**

    - **Validates: Requirements 1.4**



- [x] 6. Implement edit broadcast functionality

  - [ ] 6.1 Add updateBroadcast method to youtubeService.js
    - Call YouTube API to update broadcast details

    - _Requirements: 5.2_

  - [x] 6.2 Add getBroadcast method to youtubeService.js

    - Fetch broadcast details for edit form
    - _Requirements: 5.1_



  - [ ] 6.3 Add PUT /api/youtube/broadcasts/:id endpoint
    - Validate and update broadcast
    - Handle errors and preserve original on failure
    - _Requirements: 5.2, 5.4_
  - [ ] 6.4 Add GET /api/youtube/broadcasts/:id/details endpoint
    - Return broadcast details for edit form
    - _Requirements: 5.1_
  - [ ] 6.5 Add edit broadcast modal to youtube.ejs
    - Pre-fill form with current broadcast data
    - Add edit button to broadcast cards
    - _Requirements: 5.1, 5.3_
  - [ ] 6.6 Add edit broadcast JavaScript handlers in youtube.js
    - Open edit modal, submit changes, handle errors
    - Refresh list on success
    - _Requirements: 5.2, 5.4, 5.5_
  - [ ] 6.7 Write property test for edit form pre-fill
    - **Property 6: Edit form pre-fills all broadcast fields**
    - **Validates: Requirements 5.1**

- [ ] 7. Implement reuse broadcast functionality
  - [ ] 7.1 Add POST /api/youtube/broadcasts/:id/reuse endpoint
    - Return broadcast data for reuse (without schedule time)
    - _Requirements: 6.1, 6.2_
  - [ ] 7.2 Add reuse button to broadcast cards in youtube.ejs
    - _Requirements: 6.1_
  - [ ] 7.3 Add reuse broadcast JavaScript handlers in youtube.js
    - Open create modal with pre-filled data
    - Clear schedule time field
    - Allow account selection
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 7.4 Write property test for reuse copies correct fields
    - **Property 7: Reuse copies specified fields only**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [ ] 7.5 Write property test for reuse creates new broadcast
    - **Property 8: Reuse creates new broadcast**
    - **Validates: Requirements 6.5**

- [ ] 8. Update youtube.js for multi-account support
  - [ ] 8.1 Add loadAccounts function to fetch connected accounts
    - _Requirements: 2.1_
  - [ ] 8.2 Update connectYouTube to add account instead of replace
    - _Requirements: 1.2_
  - [ ] 8.3 Update disconnectYouTube to accept credential ID
    - Add confirmation dialog
    - _Requirements: 3.1, 3.2_
  - [ ] 8.4 Update createBroadcast to include selected accountId
    - _Requirements: 2.4, 4.3_
  - [ ] 8.5 Update loadStreams to use selected account
    - _Requirements: 2.2_
  - [ ] 8.6 Write property test for broadcast stores account ID
    - **Property 5: Broadcast stores account identifier**
    - **Validates: Requirements 4.3**

- [ ] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
