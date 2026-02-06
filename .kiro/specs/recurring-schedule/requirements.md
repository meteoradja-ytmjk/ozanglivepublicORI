# Requirements Document

## Introduction

Fitur Recurring Schedule memungkinkan pengguna untuk menjadwalkan live streaming secara otomatis dengan pola berulang harian (daily) atau mingguan (weekly). Sistem akan secara otomatis memulai stream pada waktu yang telah ditentukan sesuai dengan jadwal yang dikonfigurasi, tanpa perlu intervensi manual dari pengguna.

## Glossary

- **Recurring_Schedule**: Konfigurasi jadwal berulang yang menentukan kapan stream akan dimulai secara otomatis
- **Schedule_Type**: Tipe jadwal berulang, dapat berupa 'daily' (setiap hari) atau 'weekly' (hari tertentu dalam seminggu)
- **Schedule_Time**: Waktu dalam format HH:MM yang menentukan kapan stream dimulai
- **Schedule_Days**: Array hari dalam seminggu (0-6, dimana 0=Minggu) untuk jadwal weekly
- **Stream**: Entitas streaming yang akan dijalankan sesuai jadwal
- **Scheduler_Service**: Service yang bertanggung jawab untuk memeriksa dan menjalankan jadwal

## Requirements

### Requirement 1

**User Story:** As a user, I want to create a recurring schedule for my streams, so that I can automate my live streaming without manual intervention.

#### Acceptance Criteria

1. WHEN a user creates a new stream THEN the System SHALL display options for schedule type: 'once', 'daily', or 'weekly'
2. WHEN a user selects 'daily' schedule type THEN the System SHALL allow the user to set a specific time (HH:MM) for daily streaming
3. WHEN a user selects 'weekly' schedule type THEN the System SHALL allow the user to select one or more days of the week and a specific time
4. WHEN a user saves a recurring schedule THEN the System SHALL store the schedule configuration in the database
5. WHEN a recurring schedule is saved THEN the System SHALL validate that at least one day is selected for weekly schedules

### Requirement 2

**User Story:** As a user, I want my scheduled streams to start automatically, so that I don't need to be present to manually start them.

#### Acceptance Criteria

1. WHEN the current time matches a daily schedule time THEN the Scheduler_Service SHALL automatically start the associated stream
2. WHEN the current day and time match a weekly schedule THEN the Scheduler_Service SHALL automatically start the associated stream
3. WHEN a recurring stream starts automatically THEN the System SHALL update the stream status to 'live'
4. WHEN a recurring stream completes its duration THEN the System SHALL stop the stream and prepare for the next scheduled occurrence

### Requirement 3

**User Story:** As a user, I want to view and manage my recurring schedules, so that I can modify or disable them as needed.

#### Acceptance Criteria

1. WHEN a user views the stream list THEN the System SHALL display the recurring schedule type and next scheduled time for each stream
2. WHEN a user edits a stream with recurring schedule THEN the System SHALL allow modification of schedule type, time, and days
3. WHEN a user disables a recurring schedule THEN the System SHALL stop automatic streaming while preserving the schedule configuration
4. WHEN a user enables a previously disabled schedule THEN the System SHALL resume automatic streaming according to the saved configuration

### Requirement 4

**User Story:** As a user, I want to see the history of my recurring streams, so that I can track when my automated streams ran.

#### Acceptance Criteria

1. WHEN a recurring stream runs THEN the System SHALL log the execution in stream history with schedule type indicator
2. WHEN a user views stream history THEN the System SHALL display which streams were triggered by recurring schedules
3. WHEN a recurring stream fails to start THEN the System SHALL log the failure reason and notify the user on next login

### Requirement 5

**User Story:** As a user, I want the system to handle schedule conflicts gracefully, so that my streams don't overlap or cause issues.

#### Acceptance Criteria

1. WHEN a recurring schedule triggers while the same stream is already live THEN the System SHALL skip the scheduled start and log the event
2. WHEN multiple streams are scheduled at the same time THEN the System SHALL start them sequentially with a small delay between each
3. WHEN a stream fails to start due to missing video or configuration THEN the System SHALL mark the schedule as having an error and continue with other schedules

### Requirement 6

**User Story:** As a user, I want to serialize and deserialize schedule configurations, so that schedules can be stored and retrieved correctly.

#### Acceptance Criteria

1. WHEN a schedule configuration is saved THEN the System SHALL serialize the schedule data to JSON format for storage
2. WHEN a schedule is loaded from storage THEN the System SHALL deserialize the JSON data back to a valid schedule object
3. WHEN serializing a schedule THEN the System SHALL include all required fields: schedule_type, schedule_time, schedule_days, and enabled status
4. WHEN deserializing a schedule THEN the System SHALL validate the data structure and provide default values for missing optional fields
