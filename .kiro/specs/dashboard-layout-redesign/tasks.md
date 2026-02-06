# Implementation Plan

- [x] 1. Update layout.ejs with new three-column structure
  - [x] 1.1 Create new sidebar structure with wider width (200-220px) and text labels
    - Replace current icon-only sidebar with new sidebar containing logo + brand name at top
    - Add navigation items with both icons and text labels (Streams, Gallery, Playlist, History, Users)
    - Move user profile section to bottom of sidebar with avatar, username, and role badge
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3_
  - [x] 1.2 Add right analytics panel structure for desktop
    - Create aside element for analytics panel (~280px width)
    - Add placeholder sections for metrics and chart
    - Hide panel on mobile viewports (< 1024px)
    - _Requirements: 5.1, 5.4, 7.2_
  - [x] 1.3 Update main content area structure
    - Add search bar at top of main content
    - Add welcome header with username and filter button
    - Adjust padding and margins for new layout
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 1.4 Write property test for active navigation highlighting
    - **Property 1: Active Navigation Highlighting**
    - **Validates: Requirements 1.5**
  - [ ]* 1.5 Write property test for role badge rendering
    - **Property 2: Role Badge Rendering**
    - **Validates: Requirements 2.3**

- [x] 2. Implement CSS styles for new layout
  - [x] 2.1 Add sidebar styles in styles.css
    - Define sidebar width, background color, and nav item styles
    - Add hover and active states for navigation items
    - Style profile section at bottom of sidebar
    - _Requirements: 1.4, 1.5_
  - [x] 2.2 Add responsive styles for mobile layout
    - Collapse sidebar on viewports < 1024px
    - Hide analytics panel on mobile
    - Ensure bottom navigation remains functional
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 2.3 Write property test for responsive sidebar collapse
    - **Property 7: Responsive Sidebar Collapse**
    - **Validates: Requirements 5.4, 7.1, 7.2**
  - [ ]* 2.4 Write property test for mobile bottom navigation
    - **Property 8: Mobile Bottom Navigation**
    - **Validates: Requirements 7.3**

- [x] 3. Update dashboard.ejs with new stats cards design
  - [x] 3.1 Redesign primary stats cards row
    - Update card structure with icon, label, and value
    - Apply dark card backgrounds with rounded corners
    - Add progress bars for CPU and Memory cards
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 Add secondary stats cards with circular progress indicators
    - Create secondary cards section below main stats
    - Implement SVG-based circular progress component
    - Apply accent colors (cyan, purple) for progress rings
    - Add highlighted border for emphasis cards
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 3.3 Write property test for stats card structure
    - **Property 3: Stats Card Structure**
    - **Validates: Requirements 3.3**
  - [ ]* 3.4 Write property test for circular progress percentage
    - **Property 4: Circular Progress Percentage**
    - **Validates: Requirements 4.2**

- [x] 4. Implement welcome header component
  - [x] 4.1 Add welcome message with dynamic username
    - Create welcome header section in dashboard.ejs
    - Display "Hello, [username]" with "Welcome back!" subtitle
    - Add filter button with icon
    - _Requirements: 6.3, 6.4_
  - [ ]* 4.2 Write property test for welcome message username
    - **Property 5: Welcome Message Username**
    - **Validates: Requirements 6.3**

- [x] 5. Implement right analytics panel
  - [x] 5.1 Create analytics metrics section
    - Add metric items for Total Streams, Total Videos, Active Users, Storage Used
    - Style with icons and values
    - _Requirements: 5.2_
  - [x] 5.2 Add statistics chart placeholder
    - Create chart container section
    - Add placeholder for bar chart (can use Chart.js or simple CSS bars)
    - _Requirements: 5.3_
  - [ ]* 5.3 Write property test for analytics panel metrics
    - **Property 6: Analytics Panel Metrics**
    - **Validates: Requirements 5.2**

- [x] 6. Create backend endpoint for analytics data
  - [x] 6.1 Add /api/analytics endpoint in app.js
    - Query database for total streams count
    - Query database for total videos count
    - Query database for active users count (admin only)
    - Calculate storage used from disk info
    - Return JSON response with analytics data
    - _Requirements: 5.2_

- [x] 7. Integrate analytics data with frontend
  - [x] 7.1 Fetch analytics data on dashboard load
    - Add JavaScript to fetch /api/analytics endpoint
    - Update analytics panel metrics with fetched data
    - Handle loading and error states
    - _Requirements: 5.2, 5.3_

- [x] 8. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.


- [ ] 9. Final polish and testing
  - [x] 9.1 Test responsive behavior across breakpoints

    - Verify sidebar collapse at 1024px
    - Verify analytics panel hide on mobile
    - Verify bottom navigation on mobile
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 9.2 Test profile dropdown functionality
    - Verify dropdown opens on click


    - Verify dropdown contains Settings, Help, Sign Out options
    - _Requirements: 2.2_

- [ ] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

