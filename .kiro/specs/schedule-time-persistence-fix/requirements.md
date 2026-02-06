# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan untuk masalah waktu penjadwalan stream (schedule_time dan end_time) yang berubah ketika user membuka kembali form edit. Masalah terjadi karena konversi timezone yang tidak konsisten antara waktu lokal dan UTC saat menampilkan dan menyimpan data. Perbaikan ini mencakup semua tipe jadwal: once, daily, dan weekly.

## Glossary

- **Schedule System**: Sistem penjadwalan stream yang mengelola waktu mulai dan berakhir streaming
- **schedule_time**: Waktu mulai streaming untuk jadwal tipe "once"
- **end_time**: Waktu berakhir streaming untuk jadwal tipe "once"
- **recurring_time**: Waktu streaming harian/mingguan dalam format HH:MM (waktu lokal)
- **Local Time**: Waktu sesuai timezone user (WIB/Asia Jakarta)
- **UTC**: Coordinated Universal Time, format standar penyimpanan waktu di database
- **datetime-local**: Tipe input HTML5 yang menggunakan format YYYY-MM-DDTHH:MM dalam waktu lokal

## Requirements

### Requirement 1

**User Story:** As a user, I want the schedule start time to remain unchanged when I open the edit form, so that I don't have to re-enter the correct time.

#### Acceptance Criteria

1. WHEN a user opens the edit schedule form THEN the Schedule System SHALL display the schedule_time in local timezone format matching the originally saved time
2. WHEN a user saves the schedule without changing the time THEN the Schedule System SHALL preserve the original schedule_time value in the database
3. WHEN the schedule_time is displayed in the datetime-local input THEN the Schedule System SHALL convert UTC time from database to local time correctly

### Requirement 2

**User Story:** As a user, I want the schedule end time to remain unchanged when I open the edit form, so that my stream duration stays accurate.

#### Acceptance Criteria

1. WHEN a user opens the edit schedule form THEN the Schedule System SHALL display the end_time in local timezone format matching the originally saved time
2. WHEN a user saves the schedule without changing the end time THEN the Schedule System SHALL preserve the original end_time value in the database
3. WHEN the end_time is displayed in the datetime-local input THEN the Schedule System SHALL convert UTC time from database to local time correctly

### Requirement 3

**User Story:** As a user, I want to set schedule times using hours and minutes in my local timezone, so that the stream starts at the exact time I specify.

#### Acceptance Criteria

1. WHEN a user enters a schedule time in the datetime-local input THEN the Schedule System SHALL interpret the time as local timezone
2. WHEN the Schedule System saves the schedule time THEN the Schedule System SHALL convert local time to UTC for database storage
3. WHEN the Schedule System retrieves the schedule time THEN the Schedule System SHALL convert UTC back to local time for display

### Requirement 4

**User Story:** As a user, I want the recurring time (daily/weekly) to work correctly with my local timezone, so that streams start at the right time every day.

#### Acceptance Criteria

1. WHEN a user sets recurring_time for daily schedule THEN the Schedule System SHALL store the time in HH:MM format representing local timezone
2. WHEN the scheduler checks for daily/weekly triggers THEN the Schedule System SHALL compare against local timezone (WIB)
3. WHEN a user opens the edit form for recurring schedule THEN the Schedule System SHALL display the recurring_time unchanged

### Requirement 5

**User Story:** As a user, I want consistent time handling across all schedule types (once, daily, weekly), so that I can trust the system to start streams at the correct time.

#### Acceptance Criteria

1. WHEN a user creates a "once" schedule THEN the Schedule System SHALL store schedule_time and end_time in UTC format
2. WHEN a user creates a "daily" or "weekly" schedule THEN the Schedule System SHALL store recurring_time in HH:MM local time format
3. WHEN the Schedule System displays any schedule time THEN the Schedule System SHALL show the time in user's local timezone
