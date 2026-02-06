# Implementation Plan

## 1. Remove Confirm Password from Registration Forms

- [ ] 1.1 Update setup-account.ejs to remove confirm password field
  - Remove the confirm-password input field and label
  - Remove password match validation JavaScript
  - Keep password strength indicator
  - _Requirements: 1.1, 1.3, 1.4_

- [ ] 1.2 Update signup.ejs to remove confirm password field
  - Remove the confirm-password input field and label
  - Remove password match validation JavaScript
  - Add password strength indicator if not present
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 1.3 Update backend validation in app.js
  - Remove confirmPassword validation from /setup-account route
  - Remove confirmPassword validation from /signup route
  - Keep password strength validation
  - _Requirements: 1.3_

- [ ] 1.4 Write property test for password validation
  - **Property 2: Form Submission Without Confirmation**
  - Test that valid passwords pass validation without confirmation
  - **Validates: Requirements 1.1, 1.2, 1.3**

## 2. Add Role Badge to Navigation

- [ ] 2.1 Create role badge helper function
  - Add getRoleBadge helper in app.js helpers
  - Return appropriate HTML based on user_role
  - Include distinct styling for admin vs member
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2.2 Update layout.ejs to display role badge
  - Add role badge in desktop profile dropdown
  - Add role badge in mobile profile popup
  - Position badge next to username
  - _Requirements: 2.4, 3.1_

- [ ] 2.3 Style role badges with distinct colors and icons
  - Admin badge: Blue/gold background with ti-shield-check icon
  - Member badge: Gray/green background with ti-user icon
  - Add tooltip on hover explaining role
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 2.4 Write property test for role badge rendering
  - **Property 1: Role Badge Consistency**
  - Test that each role renders correct badge HTML
  - **Validates: Requirements 2.1, 2.2, 2.3**

## 3. Checkpoint - Ensure All Tests Pass

- [ ] 3. Ensure all tests pass, ask the user if questions arise.

## 4. Final Integration

- [ ] 4.1 Test complete registration flow
  - Verify setup-account works without confirm password
  - Verify signup works without confirm password
  - Verify password strength indicator functions correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 4.2 Test role badge display across pages
  - Verify admin badge displays correctly after login
  - Verify member badge displays correctly after login
  - Verify badge appears consistently on all authenticated pages
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [ ] 4.3 Write property test for role badge location consistency
  - **Property 3: Role Badge Location Consistency**
  - Test badge appears in same DOM location across pages
  - **Validates: Requirements 2.4, 3.1**

## 5. Final Checkpoint

- [ ] 5. Ensure all tests pass, ask the user if questions arise.
