# Implementation Plan

- [x] 1. Create Database Schema and Model

  - [x] 1.1 Add recurring_schedules table migration to database.js
    - Create table with all required columns (id, user_id, account_id, name, pattern, schedule_time, days_of_week, title_template, description, privacy_status, tags, category_id, is_active, last_run_at, next_run_at, timestamps)
    - Add foreign key constraints
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 1.2 Create RecurringSchedule model with CRUD operations
    - Implement create, findById, findByUserId, findActiveSchedules, update, delete, updateLastRun methods
    - Add validation for required fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Write unit tests for RecurringSchedule model
    - Test CRUD operations
    - Test validation logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Implement Schedule Service
  - [x] 2.1 Create ScheduleService class with job scheduling
    - Implement init(), scheduleJob(), cancelJob() methods
    - Store active jobs in memory map
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Implement placeholder replacement function
    - Support {date}, {time}, {day}, {day_short}, {month}, {year} placeholders
    - Handle edge cases (missing placeholders, invalid format)
    - _Requirements: 4.4_

  - [x] 2.3 Write property test for placeholder replacement
    - **Property 3: Placeholder Replacement** ✓
    - **Validates: Requirements 4.4**

  - [x] 2.4 Implement executeSchedule method
    - Create broadcast using YouTube service
    - Update last_run_at and next_run_at
    - Handle errors with retry logic (up to 3 times)
    - _Requirements: 1.2, 1.3, 2.3, 5.2, 5.3_

  - [x] 2.5 Implement calculateNextRun function
    - Calculate next run for daily pattern
    - Calculate next run for weekly pattern based on selected days
    - _Requirements: 1.4, 2.3_

  - [x] 2.6 Write property test for next run calculation
    - **Property 5: Next Run Calculation** ✓
    - **Validates: Requirements 1.4, 2.3**

- [x] 3. Checkpoint - Ensure model and service tests pass
  - All 22 tests passed ✓

- [x] 4. Create API Routes
  - [x] 4.1 Add schedule API routes to app.js
    - GET /api/recurring-schedules - list user schedules
    - POST /api/recurring-schedules - create schedule
    - GET /api/recurring-schedules/:id - get schedule details
    - PUT /api/recurring-schedules/:id - update schedule
    - DELETE /api/recurring-schedules/:id - delete schedule
    - POST /api/recurring-schedules/:id/toggle - toggle active status
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Add validation for weekly schedule (require at least one day)
    - Validate days_of_week is not empty when pattern is weekly
    - Return appropriate error message
    - _Requirements: 2.4_

  - [x] 4.3 Write property test for weekly schedule validation
    - **Property 2: Weekly Schedule Validation** ✓
    - **Validates: Requirements 2.4**

- [x] 5. Implement UI Components
  - [x] 5.1 Add Recurring Schedules section to youtube.ejs
    - Display schedule list with pattern, time, status
    - Add toggle switch for enable/disable
    - Add edit and delete buttons
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Create schedule modal (create/edit)
    - Pattern selector (daily/weekly radio buttons)
    - Time picker input
    - Day checkboxes for weekly pattern
    - Title template input with placeholder hints
    - Description, privacy, account selectors
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.2, 4.3_

  - [x] 5.3 Add JavaScript functions for schedule management
    - openCreateScheduleModal(), closeScheduleModal()
    - saveSchedule(), deleteSchedule(), toggleSchedule()
    - loadSchedules(), renderScheduleList()
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Initialize Service on Server Startup
  - [x] 6.1 Initialize ScheduleService in app.js
    - Load all active schedules on server start
    - Schedule jobs for each active schedule
    - _Requirements: 5.1_

  - [x] 6.2 Add logging for schedule execution
    - Log successful broadcast creation
    - Log errors and retry attempts
    - _Requirements: 5.3, 5.4_

- [x] 7. Final Checkpoint
  - All 22 tests passed ✓
