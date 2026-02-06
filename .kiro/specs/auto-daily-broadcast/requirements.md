# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk fitur Auto Daily Broadcast Creation yang memungkinkan sistem secara otomatis membuat broadcast YouTube setiap hari pada waktu yang ditentukan. Fitur ini memperbaiki dan menyempurnakan logika recurring schedule yang sudah ada agar broadcast benar-benar dibuat secara otomatis tanpa intervensi manual.

## Glossary

- **Broadcast_Template**: Konfigurasi broadcast yang disimpan dengan pengaturan recurring untuk pembuatan otomatis
- **Auto_Create_Service**: Service backend (ScheduleService) yang menjalankan pembuatan broadcast otomatis
- **Recurring_Time**: Waktu spesifik setiap hari ketika broadcast akan dibuat secara otomatis
- **Next_Run_At**: Timestamp yang menunjukkan kapan broadcast berikutnya akan dibuat
- **StreamFlow_System**: Aplikasi streaming management yang mengelola broadcast YouTube

## Requirements

### Requirement 1

**User Story:** As a content creator, I want to enable daily auto-create on my template, so that a new broadcast is automatically created every day at my specified time.

#### Acceptance Criteria

1. WHEN a user enables recurring mode on a template with daily pattern THEN the StreamFlow_System SHALL calculate and store the next_run_at timestamp
2. WHEN the server time reaches the scheduled recurring_time THEN the StreamFlow_System SHALL automatically create a new broadcast using the template settings
3. WHEN a broadcast is successfully created THEN the StreamFlow_System SHALL update last_run_at and calculate the next next_run_at for tomorrow
4. WHEN the template has a stream_id configured THEN the StreamFlow_System SHALL bind the new broadcast to that existing stream key

### Requirement 2

**User Story:** As a content creator, I want the auto-create to work reliably even after server restart, so that I don't miss any scheduled broadcasts.

#### Acceptance Criteria

1. WHEN the server starts THEN the StreamFlow_System SHALL initialize ScheduleService and load all templates with recurring_enabled
2. WHEN a template's next_run_at is in the past (missed schedule) THEN the StreamFlow_System SHALL create the broadcast immediately and recalculate next_run_at
3. WHEN checking schedules THEN the StreamFlow_System SHALL verify the template has not already run today before creating
4. IF broadcast creation fails THEN the StreamFlow_System SHALL retry up to 3 times with 30-second intervals

### Requirement 3

**User Story:** As a content creator, I want to see when my next auto-broadcast will be created, so that I can verify the schedule is working correctly.

#### Acceptance Criteria

1. WHEN viewing Template Library THEN the StreamFlow_System SHALL display the next_run_at timestamp for templates with recurring enabled
2. WHEN a template's recurring is toggled on THEN the StreamFlow_System SHALL immediately calculate and display the next scheduled run
3. WHEN viewing template details THEN the StreamFlow_System SHALL show last_run_at and next_run_at timestamps
4. WHEN a broadcast is auto-created THEN the StreamFlow_System SHALL log the creation with template name and broadcast details

### Requirement 4

**User Story:** As a content creator, I want the auto-created broadcast to use my template settings including title placeholders, so that each broadcast has the correct date in the title.

#### Acceptance Criteria

1. WHEN creating an auto-broadcast THEN the StreamFlow_System SHALL replace {date} placeholder with current date in DD/MM/YYYY format
2. WHEN creating an auto-broadcast THEN the StreamFlow_System SHALL replace {time} placeholder with scheduled time in HH:mm format
3. WHEN creating an auto-broadcast THEN the StreamFlow_System SHALL use template's privacy_status, description, tags, and category_id
4. WHEN creating an auto-broadcast THEN the StreamFlow_System SHALL schedule the broadcast start time 10 minutes from creation time

### Requirement 5

**User Story:** As a content creator, I want to quickly toggle auto-create on/off without editing all template settings, so that I can pause and resume scheduling easily.

#### Acceptance Criteria

1. WHEN a user clicks the recurring toggle button THEN the StreamFlow_System SHALL enable or disable recurring without opening edit form
2. WHEN recurring is toggled off THEN the StreamFlow_System SHALL preserve recurring_pattern, recurring_time, and recurring_days for future re-activation
3. WHEN recurring is toggled on THEN the StreamFlow_System SHALL recalculate next_run_at based on current time and recurring_time
4. WHEN toggle status changes THEN the StreamFlow_System SHALL update the UI immediately to reflect new status

