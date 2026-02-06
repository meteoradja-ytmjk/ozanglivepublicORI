# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk fitur Scheduled Recurring Broadcasts yang memungkinkan pengguna membuat jadwal broadcast berulang secara otomatis. Fitur ini mendukung penjadwalan harian (daily) dan mingguan (weekly), sehingga broadcast akan dibuat secara otomatis sesuai jadwal yang ditentukan tanpa perlu membuat manual setiap kali.

## Glossary

- **Recurring_Schedule**: Konfigurasi jadwal berulang yang menentukan kapan broadcast akan dibuat secara otomatis
- **Schedule_Pattern**: Pola jadwal yang bisa berupa daily (setiap hari) atau weekly (hari tertentu setiap minggu)
- **Schedule_Time**: Waktu spesifik dalam sehari ketika broadcast akan dijadwalkan
- **Schedule_Days**: Hari-hari dalam seminggu yang dipilih untuk jadwal weekly
- **Auto_Create_Service**: Service backend yang menjalankan pembuatan broadcast otomatis berdasarkan jadwal

## Requirements

### Requirement 1

**User Story:** As a user, I want to create a daily recurring schedule for broadcasts, so that broadcasts are automatically created every day at a specific time.

#### Acceptance Criteria

1. WHEN a user selects daily schedule pattern THEN the system SHALL display a time picker for selecting broadcast time
2. WHEN a daily schedule is active THEN the system SHALL automatically create a new broadcast every day at the specified time
3. WHEN creating a daily broadcast THEN the system SHALL use the template settings (title, description, privacy, tags) from the schedule configuration
4. WHEN a daily broadcast is created THEN the system SHALL schedule it for the next occurrence of the specified time

### Requirement 2

**User Story:** As a user, I want to create a weekly recurring schedule for broadcasts, so that broadcasts are automatically created on specific days each week.

#### Acceptance Criteria

1. WHEN a user selects weekly schedule pattern THEN the system SHALL display checkboxes for selecting days of the week
2. WHEN a user selects weekly schedule pattern THEN the system SHALL display a time picker for selecting broadcast time
3. WHEN a weekly schedule is active THEN the system SHALL automatically create broadcasts on selected days at the specified time
4. WHEN no days are selected for weekly schedule THEN the system SHALL prevent saving the schedule and display an error message

### Requirement 3

**User Story:** As a user, I want to manage my recurring schedules, so that I can view, edit, enable/disable, and delete them.

#### Acceptance Criteria

1. WHEN the user views the schedule list THEN the system SHALL display all recurring schedules with their pattern, time, and status
2. WHEN the user toggles a schedule status THEN the system SHALL enable or disable the automatic broadcast creation
3. WHEN the user edits a schedule THEN the system SHALL allow modification of pattern, time, days, and template settings
4. WHEN the user deletes a schedule THEN the system SHALL remove the schedule and stop future automatic broadcasts

### Requirement 4

**User Story:** As a user, I want to configure broadcast template settings for each schedule, so that automatically created broadcasts have the correct title, description, and settings.

#### Acceptance Criteria

1. WHEN creating a recurring schedule THEN the system SHALL allow setting broadcast title with date/time placeholders
2. WHEN creating a recurring schedule THEN the system SHALL allow setting description, privacy status, and tags
3. WHEN creating a recurring schedule THEN the system SHALL allow selecting a YouTube account for the broadcasts
4. WHEN a broadcast is auto-created THEN the system SHALL replace placeholders in title with actual date/time values

### Requirement 5

**User Story:** As a system administrator, I want the recurring schedule service to run reliably, so that broadcasts are created on time without manual intervention.

#### Acceptance Criteria

1. WHEN the server starts THEN the system SHALL initialize the schedule service and load all active schedules
2. WHEN a scheduled time arrives THEN the system SHALL create the broadcast within 1 minute of the scheduled time
3. IF broadcast creation fails THEN the system SHALL log the error and retry up to 3 times
4. WHEN a broadcast is successfully created THEN the system SHALL log the creation with schedule ID and broadcast details
