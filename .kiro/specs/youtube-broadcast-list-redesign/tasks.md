# Implementation Plan

- [x] 1. Update Header Buttons to 2-Grid Layout

  - [x] 1.1 Modify header section in youtube.ejs to use CSS grid with 2 columns


    - Change existing button container to use `display: grid; grid-template-columns: 1fr 1fr`
    - Ensure Template button and Create New (+) button have equal width


    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Write unit test for header buttons grid layout

    - Verify 2-column grid structure
    - Verify both buttons are present with icons and labels


    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement Compact List Item Structure


  - [x] 2.1 Replace existing card-based broadcast items with compact list rows


    - Create new list item structure with: number, title, privacy status, stream key, action buttons
    - Remove thumbnail display and large card styling




    - Use flexbox for horizontal alignment within each row
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Write property test for essential information display






    - **Property 1: Essential Information Display**
    - **Validates: Requirements 2.2, 4.1, 4.2**




  - [x] 2.3 Implement stream key display with truncation and click-to-copy




    - Display stream key in truncated format (max 20 chars with ellipsis)





    - Show "-" placeholder when stream key is empty

    - Add click handler to copy stream key to clipboard
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Implement Compact Action Buttons


  - [ ] 3.1 Replace large action buttons with compact icon-only buttons
    - Create 32x32px icon-only buttons for edit, sync, delete
    - Apply color coding: Edit (blue), Sync (green), Delete (red)




    - Align buttons horizontally at the end of each list item
    - _Requirements: 3.1, 3.2, 3.3_
  - [-] 3.2 Write property test for action buttons presence

    - **Property 2: Action Buttons Presence**
    - **Validates: Requirements 3.1**
  - [ ] 3.3 Ensure action button click handlers work correctly
    - Verify edit button opens edit modal
    - Verify sync button triggers reuse/copy broadcast
    - Verify delete button shows confirmation dialog
    - _Requirements: 3.4_

- [ ] 4. Implement Mobile Responsive Layout
  - [ ] 4.1 Add CSS media queries for mobile layout
    - Maintain 2-grid layout for header buttons on mobile
    - Stack broadcast info vertically on mobile (number+title+privacy on first line, stream key on second)
    - Keep action buttons in horizontal row with minimum 36px touch target
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 4.2 Write unit test for mobile responsive behavior
    - Verify header buttons remain in 2-grid on mobile
    - Verify action buttons meet minimum touch target size
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 5. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
