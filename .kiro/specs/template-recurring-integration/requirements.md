# Requirements Document

## Introduction

Fitur ini mengintegrasikan kemampuan recurring schedule (daily/weekly) langsung ke dalam Broadcast Template. Dengan integrasi ini, user tidak perlu mengelola recurring schedules secara terpisah - cukup mengaktifkan opsi recurring pada template yang sudah ada. Kolom "Recurring Schedules" yang terpisah akan dihapus dari UI, dan semua fungsionalitas recurring akan diakses melalui Template Library.

## Glossary

- **Broadcast_Template**: Konfigurasi broadcast yang disimpan untuk digunakan kembali, sekarang dengan kemampuan recurring schedule
- **Recurring_Mode**: Mode penjadwalan berulang yang bisa diaktifkan pada template (daily atau weekly)
- **Schedule_Time**: Waktu spesifik dalam sehari ketika broadcast akan dijadwalkan secara otomatis
- **Schedule_Days**: Hari-hari dalam seminggu yang dipilih untuk jadwal weekly
- **StreamFlow_System**: Aplikasi streaming management yang mengelola broadcast YouTube
- **Template_Library**: Daftar semua template yang tersimpan milik user, termasuk status recurring

## Requirements

### Requirement 1

**User Story:** As a content creator, I want to enable recurring schedule on my existing template, so that broadcasts are automatically created without managing separate recurring schedules.

#### Acceptance Criteria

1. WHEN a user edits a template THEN the StreamFlow_System SHALL display a toggle option to enable recurring mode
2. WHEN recurring mode is enabled THEN the StreamFlow_System SHALL display pattern selection (daily or weekly) and time picker
3. WHEN weekly pattern is selected THEN the StreamFlow_System SHALL display checkboxes for selecting days of the week
4. WHEN a user saves a template with recurring enabled THEN the StreamFlow_System SHALL store the recurring configuration in the template record
5. IF weekly pattern is selected without any days THEN the StreamFlow_System SHALL display a validation error and prevent saving

### Requirement 2

**User Story:** As a content creator, I want to see recurring status in my template list, so that I can quickly identify which templates have automatic scheduling.

#### Acceptance Criteria

1. WHEN viewing Template Library THEN the StreamFlow_System SHALL display recurring status indicator for each template
2. WHEN a template has recurring enabled THEN the StreamFlow_System SHALL show the pattern (daily/weekly), time, and next scheduled run
3. WHEN a template has recurring disabled THEN the StreamFlow_System SHALL show no recurring indicator
4. WHEN viewing template details THEN the StreamFlow_System SHALL display full recurring configuration if enabled

### Requirement 3

**User Story:** As a content creator, I want to toggle recurring on/off for a template without editing all settings, so that I can quickly pause and resume automatic scheduling.

#### Acceptance Criteria

1. WHEN a user clicks the recurring toggle on a template THEN the StreamFlow_System SHALL enable or disable automatic broadcast creation
2. WHEN recurring is toggled off THEN the StreamFlow_System SHALL preserve the recurring configuration for future re-activation
3. WHEN recurring is toggled on THEN the StreamFlow_System SHALL calculate and display the next scheduled run time
4. WHEN recurring status changes THEN the StreamFlow_System SHALL update the template list display immediately

### Requirement 4

**User Story:** As a content creator, I want the recurring schedules section removed from the main UI, so that I have a cleaner interface with all scheduling managed through templates.

#### Acceptance Criteria

1. WHEN the user views the YouTube page THEN the StreamFlow_System SHALL NOT display the separate "Recurring Schedules" section
2. WHEN the user wants to create recurring broadcasts THEN the StreamFlow_System SHALL direct them to create or edit a template with recurring enabled
3. WHEN existing recurring schedules exist THEN the StreamFlow_System SHALL migrate them to template-based recurring during system update

### Requirement 5

**User Story:** As a system administrator, I want the recurring service to work with template-based recurring, so that broadcasts are created automatically from templates with recurring enabled.

#### Acceptance Criteria

1. WHEN the server starts THEN the StreamFlow_System SHALL initialize the schedule service and load all templates with recurring enabled
2. WHEN a scheduled time arrives THEN the StreamFlow_System SHALL create the broadcast using the template settings within 1 minute
3. IF broadcast creation fails THEN the StreamFlow_System SHALL log the error and retry up to 3 times
4. WHEN a broadcast is successfully created THEN the StreamFlow_System SHALL update the template's last_run_at and calculate next_run_at

### Requirement 6

**User Story:** As a content creator, I want to create a new template with recurring enabled from the start, so that I can set up automatic scheduling in one step.

#### Acceptance Criteria

1. WHEN creating a new template THEN the StreamFlow_System SHALL display recurring options alongside other template fields
2. WHEN a user enables recurring during template creation THEN the StreamFlow_System SHALL validate both template fields and recurring configuration
3. WHEN the template is saved with recurring THEN the StreamFlow_System SHALL immediately schedule the first automatic broadcast creation

