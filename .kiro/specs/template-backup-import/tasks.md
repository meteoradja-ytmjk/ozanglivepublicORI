# Implementation Plan

- [x] 1. Extend Backup Service with template-specific functions




  - [ ] 1.1 Add exportTemplatesOnly function to backupService.js
    - Create function that exports only broadcast templates for a user
    - Include metadata with exportDate, appVersion, exportType, totalTemplates


    - Export fields: name, title, description, privacy_status, tags, category_id, recurring_enabled, recurring_pattern, recurring_time, recurring_days

    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Write property test for export contains all templates

    - **Property 1: Export contains all user templates**
    - **Validates: Requirements 1.1, 1.2**
  - [ ] 1.3 Write property test for exported templates have required fields
    - **Property 2: Exported templates have required fields**

    - **Validates: Requirements 1.3**
  - [x] 1.4 Add validateTemplateBackup function to backupService.js

    - Validate metadata exists with required fields
    - Validate templates array exists
    - Return valid status, errors array, and templateCount
    - _Requirements: 2.1, 2.4_
  - [x] 1.5 Write property test for validation rejects invalid format

    - **Property 3: Import validation rejects invalid format**
    - **Validates: Requirements 2.1, 2.4**

  - [ ] 1.6 Add importTemplatesOnly function to backupService.js
    - Validate each template for required fields (name, title)

    - Validate recurring configuration when enabled
    - Handle duplicate names with skipDuplicates option

    - Return imported count, skipped count, and errors array
    - _Requirements: 2.3, 2.5, 5.1, 5.2, 5.3, 5.4_

  - [ ] 1.7 Write property test for import creates templates
    - **Property 4: Import creates templates for valid items**

    - **Validates: Requirements 2.3, 3.1**
  - [x] 1.8 Write property test for duplicate handling




    - **Property 5: Duplicate handling with skip option**
    - **Validates: Requirements 2.5**
  - [x] 1.9 Write property test for required field validation

    - **Property 6: Required field validation**
    - **Validates: Requirements 5.1**
  - [ ] 1.10 Write property test for recurring validation
    - **Property 7: Recurring configuration validation**
    - **Validates: Requirements 5.2, 5.3**

  - [ ] 1.11 Write property test for partial import
    - **Property 8: Partial import continues on failure**

    - **Validates: Requirements 5.4, 3.2**





- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.



- [ ] 3. Add API endpoints for template export/import
  - [ ] 3.1 Add GET /api/templates/export endpoint in app.js
    - Call exportTemplatesOnly from backupService
    - Set response headers for file download

    - Generate filename with format templates-backup-{timestamp}.json
    - _Requirements: 1.1, 1.4_
  - [ ] 3.2 Add POST /api/templates/import endpoint in app.js
    - Accept multipart/form-data with JSON file


    - Parse and validate file using validateTemplateBackup
    - Call importTemplatesOnly with parsed data
    - Return import results with counts and errors
    - _Requirements: 2.1, 2.3, 3.1, 3.2_
  - [ ] 3.3 Write property test for round-trip consistency
    - **Property 9: Round-trip consistency**
    - **Validates: Requirements 6.2**



- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add UI components for template backup/import
  - [ ] 5.1 Add export and import buttons to template library modal header
    - Add Export button with download icon
    - Add Import button with upload icon
    - Style buttons to match existing UI
    - _Requirements: 4.1_
  - [ ] 5.2 Create import template modal in youtube.ejs
    - Add file input for JSON file selection
    - Add preview area showing template count
    - Add skipDuplicates checkbox option
    - Add confirm and cancel buttons
    - _Requirements: 2.2, 2.5_
  - [ ] 5.3 Create import result modal in youtube.ejs
    - Display imported count, skipped count
    - Display error messages if any
    - Add close button
    - _Requirements: 3.1, 3.2_
  - [ ] 5.4 Add JavaScript functions for export/import in youtube.ejs
    - Add exportTemplates() function to trigger download
    - Add openImportTemplateModal() function
    - Add previewImportFile() function to read and validate file
    - Add confirmImportTemplates() function to call API
    - Add showImportResults() function to display results
    - Add loading indicators during operations
    - Refresh template list after successful import
    - _Requirements: 4.2, 4.3, 3.3_

- [ ] 6. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
