# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan untuk masalah penjadwalan stream dimana waktu Start Stream dan End Stream berubah ketika modal edit dibuka kembali. Masalah utama adalah ketidakcocokan antara nama field yang dikirim dari frontend dengan yang diharapkan oleh API backend, serta penanganan timezone yang tidak konsisten.

## Glossary

- **Schedule System**: Sistem penjadwalan yang mengelola kapan stream dimulai dan berakhir
- **Schedule Type**: Tipe jadwal (once, daily, weekly)
- **Start Stream**: Waktu mulai streaming
- **End Stream**: Waktu berakhir streaming
- **Recurring Time**: Waktu untuk jadwal berulang (daily/weekly) dalam format HH:MM
- **Duration**: Durasi streaming dalam menit
- **Local Time**: Waktu lokal pengguna (WIB/Asia Jakarta)
- **ISO String**: Format waktu standar ISO 8601 yang disimpan di database

## Requirements

### Requirement 1

**User Story:** As a user, I want to edit schedule times and have them persist correctly, so that my streams start and end at the times I specified.

#### Acceptance Criteria

1. WHEN a user opens the edit schedule modal THEN the Schedule System SHALL display the correct Start Stream and End Stream times in local timezone
2. WHEN a user saves schedule changes THEN the Schedule System SHALL send the correct field names to the API (scheduleStartTime, scheduleEndTime, streamDurationMinutes)
3. WHEN a user sets duration using hours and minutes fields THEN the Schedule System SHALL calculate and send stream_duration_minutes correctly
4. WHEN a user reopens the edit modal after saving THEN the Schedule System SHALL display the same times that were previously saved

### Requirement 2

**User Story:** As a user, I want daily and weekly schedules to work correctly, so that my recurring streams start at the specified time.

#### Acceptance Criteria

1. WHEN a user sets a daily schedule time THEN the Schedule System SHALL save the recurring_time in HH:MM format
2. WHEN a user sets a weekly schedule with specific days THEN the Schedule System SHALL save both recurring_time and schedule_days correctly
3. WHEN a user enables/disables recurring THEN the Schedule System SHALL update recurring_enabled status correctly
4. WHEN the scheduler checks recurring schedules THEN the Schedule System SHALL trigger streams at the exact specified time (within 1 minute tolerance)

### Requirement 3

**User Story:** As a user, I want the duration field to work correctly, so that my streams run for the specified duration.

#### Acceptance Criteria

1. WHEN a user sets duration in hours and minutes THEN the Schedule System SHALL calculate total minutes correctly (hours * 60 + minutes)
2. WHEN a user saves a stream with duration THEN the Schedule System SHALL persist stream_duration_minutes to the database
3. WHEN a user reopens the edit modal THEN the Schedule System SHALL display the correct hours and minutes from saved duration
4. WHEN a stream is running THEN the Schedule System SHALL stop the stream after the specified duration

### Requirement 4

**User Story:** As a user, I want consistent timezone handling, so that times are displayed and saved correctly regardless of server timezone.

#### Acceptance Criteria

1. WHEN displaying schedule times THEN the Schedule System SHALL convert ISO strings to local timezone for display
2. WHEN saving schedule times THEN the Schedule System SHALL convert local datetime-local input to ISO string for storage
3. WHEN the scheduler triggers streams THEN the Schedule System SHALL use consistent timezone (WIB) for comparison
