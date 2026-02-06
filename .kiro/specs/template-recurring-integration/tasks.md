# Implementation Plan

- [x] 1. Update database schema and model

  - [x] 1.1 Add recurring columns to broadcast_templates table


    - Add migration to add recurring_enabled, recurring_pattern, recurring_time, recurring_days, last_run_at, next_run_at columns


    - Update database.js initialization to include new columns


    - _Requirements: 1.4_
  - [ ] 1.2 Update BroadcastTemplate model with recurring fields
    - Add recurring fields to create, update, findById, findByUserId methods
    - Add findWithRecurringEnabled() method for scheduler


    - Add updateRecurring() method for recurring-specific updates

    - Add toggleRecurring() method for quick on/off
    - _Requirements: 1.4, 3.1_

  - [x] 1.3 Write property test for template recurring round-trip




    - **Property 1: Template Recurring Data Round-Trip**
    - **Validates: Requirements 1.4**
  - [x] 1.4 Write property test for weekly validation


    - **Property 2: Weekly Pattern Requires Days Validation**

    - **Validates: Requirements 1.5**

- [x] 2. Implement recurring validation and calculation logic








  - [x] 2.1 Create recurring validation utility

    - Validate pattern is 'daily' or 'weekly'

    - Validate time format HH:MM


    - Validate weekly has at least one day selected

    - _Requirements: 1.5, 6.2_
  - [ ] 2.2 Create next run calculation utility
    - Calculate next occurrence for daily pattern


    - Calculate next occurrence for weekly pattern based on selected days




    - Handle timezone considerations
    - _Requirements: 3.3, 6.3_
  - [x] 2.3 Write property test for next run calculation

    - **Property 6: Next Run Calculation Correctness**
    - **Validates: Requirements 3.3, 6.3**
  - [x] 2.4 Write property test for toggle preservation


    - **Property 5: Toggle Preserves Configuration**


    - **Validates: Requirements 3.2**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update API routes for template recurring
  - [ ] 4.1 Add PUT /api/templates/:id/recurring endpoint
    - Accept recurring configuration in request body
    - Validate recurring settings
    - Update template with recurring config
    - Calculate and set next_run_at
    - _Requirements: 1.4, 3.3_
  - [ ] 4.2 Add POST /api/templates/:id/recurring/toggle endpoint
    - Toggle recurring_enabled on/off
    - Preserve existing recurring configuration
    - Recalculate next_run_at when enabling
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 4.3 Add GET /api/templates/recurring endpoint
    - Return all templates with recurring_enabled = true
    - Include next_run_at and pattern info
    - _Requirements: 5.1_
  - [ ] 4.4 Write property test for combined validation
    - **Property 9: Combined Validation on Create**
    - **Validates: Requirements 6.2**

- [ ] 5. Update scheduler service
  - [ ] 5.1 Modify schedulerService to use templates
    - Change loadActiveSchedules to call BroadcastTemplate.findWithRecurringEnabled()
    - Update processSchedule to work with template structure
    - Update broadcast creation to use template fields
    - _Requirements: 5.1, 5.2_
  - [ ] 5.2 Update timestamp handling after broadcast creation
    - Set last_run_at to current time after successful creation
    - Calculate and set next_run_at for next occurrence
    - _Requirements: 5.4_
  - [x] 5.3 Write property test for broadcast creation timestamps





    - **Property 8: Broadcast Creation Updates Timestamps**
    - **Validates: Requirements 5.4**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update UI - Template form with recurring options
  - [ ] 7.1 Add recurring section to template form in youtube.ejs
    - Add toggle for enabling recurring
    - Add pattern radio buttons (daily/weekly)
    - Add time picker input
    - Add day checkboxes for weekly pattern
    - Show/hide fields based on recurring enabled and pattern
    - _Requirements: 1.1, 1.2, 1.3, 6.1_
  - [ ] 7.2 Add client-side validation for recurring
    - Validate weekly pattern has days selected
    - Validate time format
    - Show validation errors inline
    - _Requirements: 1.5_
  - [ ] 7.3 Update template save/update to include recurring data
    - Collect recurring fields from form
    - Send to API with template data
    - _Requirements: 1.4_

- [ ] 8. Update UI - Template list with recurring indicator
  - [ ] 8.1 Add recurring status display to template list items
    - Show recurring icon/badge when enabled
    - Display pattern (Daily/Weekly) and time
    - Show next scheduled run datetime
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 8.2 Add quick toggle button for recurring in template list
    - Toggle button to enable/disable recurring





    - Update display immediately on toggle
    - _Requirements: 3.1, 3.4_
  - [x] 8.3 Write property test for recurring display


    - **Property 3: Recurring Display Contains Required Info**
    - **Validates: Requirements 2.2**
  - [ ] 8.4 Write property test for disabled recurring display
    - **Property 4: Disabled Recurring Shows No Indicator**
    - **Validates: Requirements 2.3**

- [ ] 9. Remove Recurring Schedules section from UI
  - [ ] 9.1 Remove Recurring Schedules section from youtube.ejs
    - Remove the "Recurring Schedules" card/section
    - Remove related JavaScript functions for recurring schedules UI
    - Keep scheduler service backend intact (now uses templates)
    - _Requirements: 4.1_

- [ ] 10. Create migration for existing recurring schedules
  - [ ] 10.1 Create migration script to convert recurring_schedules to templates
    - For each recurring_schedule, create a template with recurring enabled
    - Copy pattern, time, days, and broadcast settings
    - Mark original recurring_schedule as migrated or delete
    - _Requirements: 4.3_
  - [ ] 10.2 Write property test for migration
    - **Property 7: Migration Preserves Schedule Data**
    - **Validates: Requirements 4.3**

- [ ] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
