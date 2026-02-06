# Requirements Document

## Introduction

Fitur ini memperbaiki masalah livestreaming yang tidak berhenti/stop sesuai durasi yang sudah user input. Masalah terjadi terutama pada recurring streams (daily/weekly) dimana stream terus berjalan melebihi durasi yang ditentukan. Sistem harus memastikan stream berhenti tepat waktu berdasarkan `stream_duration_minutes` yang diinput user.

## Glossary

- **Stream**: Sesi livestreaming yang dikonfigurasi user dengan video, platform, dan durasi tertentu
- **Recurring Stream**: Stream dengan jadwal berulang (daily atau weekly)
- **stream_duration_minutes**: Field database yang menyimpan durasi stream dalam menit
- **FFmpeg**: Tool untuk encoding dan streaming video
- **Scheduler Service**: Service yang mengelola jadwal start/stop stream
- **Duration Calculator**: Utility untuk menghitung durasi stream secara konsisten

## Requirements

### Requirement 1

**User Story:** As a user, I want my livestream to automatically stop after the duration I specified, so that I don't have to manually stop the stream.

#### Acceptance Criteria

1. WHEN a stream starts with `stream_duration_minutes` set THEN the System SHALL pass the correct duration (in seconds) to FFmpeg `-t` parameter
2. WHEN a recurring stream (daily/weekly) starts THEN the System SHALL use `stream_duration_minutes` as the primary source for duration calculation, ignoring stale `schedule_time` and `end_time` values
3. WHEN the scheduler checks stream durations THEN the System SHALL calculate end time based on actual `start_time` plus `stream_duration_minutes`
4. WHEN a stream exceeds its expected end time by more than 2 minutes THEN the System SHALL force stop the stream immediately

### Requirement 2

**User Story:** As a user, I want the system to have multiple layers of protection to ensure my stream stops on time, so that I can trust the system to manage my streams reliably.

#### Acceptance Criteria

1. WHEN FFmpeg `-t` parameter fails to stop the stream THEN the Scheduler Service SHALL detect the overdue stream and stop it
2. WHEN the scheduler detects a live stream THEN the System SHALL log duration fields (`stream_duration_minutes`, `start_time`, calculated end time) for debugging
3. WHEN a stream is force-stopped due to duration exceeded THEN the System SHALL log the reason clearly

### Requirement 3

**User Story:** As a user, I want to see accurate duration information in the dashboard, so that I know how long my stream will run.

#### Acceptance Criteria

1. WHEN displaying stream duration in dashboard THEN the System SHALL show the value from `stream_duration_minutes` formatted as "X jam" or "X jam Y menit"
2. WHEN a stream is live THEN the System SHALL display remaining time based on `start_time` and `stream_duration_minutes`
