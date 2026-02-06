# Implementation Plan

## 1. Database Schema Update

- [x] 1.1 Add permission columns to users table
  - Create database migration to add `can_view_videos`, `can_download_videos`, `can_delete_videos` columns
  - Set default value to 1 (enabled) for all columns
  - Update `db/database.js` to include new columns in table creation
  - _Requirements: 5.1_

## 2. User Model Extensions

- [x] 2.1 Add permission methods to User model
  - Implement `updatePermission(userId, permission, value)` method
  - Implement `bulkUpdatePermissions(userIds, permissions)` method
  - Implement `getPermissions(userId)` method
  - Update `create()` method to include default permissions
  - _Requirements: 4.1, 5.1, 6.3_

- [x] 2.2 Write property test for default permissions
  - **Property 5: Default Permissions for New Users**
  - **Validates: Requirements 5.1**

- [x] 2.3 Write property test for permission persistence
  - **Property 4: Permission Persistence**
  - **Validates: Requirements 4.1, 4.2**

## 3. Permission Middleware

- [x] 3.1 Create permission check middleware
  - Implement `canViewVideos` middleware
  - Implement `canDownloadVideos` middleware
  - Implement `canDeleteVideos` middleware
  - Add middleware to relevant routes
  - _Requirements: 1.2, 1.3, 2.3, 2.4, 3.3, 3.4_

- [x] 3.2 Write property test for view permission enforcement
  - **Property 1: View Permission Enforcement**
  - **Validates: Requirements 1.2, 1.3**

- [x] 3.3 Write property test for download permission enforcement
  - **Property 2: Download Permission Enforcement**
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 3.4 Write property test for delete permission enforcement
  - **Property 3: Delete Permission Enforcement**
  - **Validates: Requirements 3.2, 3.3, 3.4**

## 4. Permission API Endpoints

- [x] 4.1 Create single permission update API
  - Implement `POST /api/users/permission` endpoint
  - Validate permission type and value
  - Prevent admin from modifying own permissions
  - Return success notification
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.2 Create bulk permission update API
  - Implement `POST /api/users/bulk-permissions` endpoint
  - Accept array of user IDs and permission settings
  - Update all selected users
  - Return count of updated users
  - _Requirements: 6.3, 6.4_

- [x] 4.3 Write property test for bulk permission update
  - **Property 6: Bulk Permission Update Consistency**
  - **Validates: Requirements 6.3**

## 5. Checkpoint - Ensure Backend Tests Pass

- [x] 5.1 Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 6. User Management UI Updates

- [x] 6.1 Add permission toggles to user management page
  - Add toggle switches for each permission type per member
  - Add checkbox column for bulk selection
  - Add "Select All" checkbox functionality
  - Add bulk action dropdown with permission options
  - Wire up AJAX calls to permission APIs
  - _Requirements: 1.1, 2.1, 3.1, 5.2, 6.1, 6.2, 6.5_

## 7. Gallery UI Updates

- [x] 7.1 Update gallery view with permission checks
  - Check `can_view_videos` permission before displaying videos
  - Show permission denied message if view is disabled
  - Conditionally render download button based on `can_download_videos`
  - Conditionally render delete button based on `can_delete_videos`
  - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 3.3_

## 8. Video API Permission Enforcement

- [x] 8.1 Apply permission middleware to video APIs
  - Add `canDownloadVideos` middleware to download endpoint
  - Add `canDeleteVideos` middleware to delete endpoint
  - Return proper error responses for unauthorized access
  - _Requirements: 2.3, 2.4, 3.3, 3.4_

## 9. Final Checkpoint

- [x] 9.1 Final verification
  - Ensure all tests pass, ask the user if questions arise.
