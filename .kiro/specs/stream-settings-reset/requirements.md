# Requirements Document

## Introduction

Fitur ini memperbaiki fungsi "Reset All Stream" pada menu Backup di dashboard. Saat ini, tombol reset hanya me-reload data dari database tanpa mengembalikan settingan stream ke nilai awal saat file backup di-import. Fitur baru akan menyimpan settingan original saat import dan memungkinkan user untuk mengembalikan semua stream ke settingan tersebut.

## Glossary

- **Stream**: Konfigurasi streaming yang berisi informasi seperti jadwal, durasi, RTMP URL, dan pengaturan lainnya
- **Original Settings**: Settingan stream yang disimpan saat pertama kali file backup di-import
- **Reset**: Proses mengembalikan settingan stream ke nilai original saat import
- **Backup Service**: Service yang menangani export dan import konfigurasi stream

## Requirements

### Requirement 1

**User Story:** As a user, I want to reset all stream settings to their original imported values, so that I can restore my streams to the initial configuration when needed.

#### Acceptance Criteria

1. WHEN a backup file is imported THEN the System SHALL store the original settings for each stream in a dedicated field
2. WHEN a user clicks "Reset All Stream" button THEN the System SHALL restore all stream settings to their original imported values
3. WHEN resetting stream settings THEN the System SHALL restore schedule_time, recurring_time, stream_duration_minutes, schedule_type, schedule_days, and recurring_enabled to original values
4. WHEN a stream has no original settings stored THEN the System SHALL skip that stream during reset operation
5. WHEN reset operation completes THEN the System SHALL display a success message with the count of streams reset

### Requirement 2

**User Story:** As a user, I want confirmation before resetting all streams, so that I don't accidentally lose my current configurations.

#### Acceptance Criteria

1. WHEN a user clicks "Reset All Stream" button THEN the System SHALL display a confirmation dialog explaining the action
2. WHEN a user confirms the reset action THEN the System SHALL proceed with resetting all streams
3. WHEN a user cancels the reset action THEN the System SHALL abort the operation and maintain current settings

### Requirement 3

**User Story:** As a user, I want to see which settings will be reset, so that I understand what changes will occur.

#### Acceptance Criteria

1. WHEN displaying the confirmation dialog THEN the System SHALL list the settings that will be reset (schedule time, duration, schedule type, etc.)
2. WHEN reset is complete THEN the System SHALL refresh the stream list to show updated values
