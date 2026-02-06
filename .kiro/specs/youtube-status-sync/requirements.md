# Requirements Document

## Introduction

YouTube Status Sync adalah fitur untuk menyinkronkan status stream antara aplikasi StreamFlow dengan YouTube Live. Saat ini, ketika live streaming selesai di YouTube (baik karena user menghentikan dari YouTube Studio atau karena broadcast berakhir), aplikasi StreamFlow tidak mendeteksi perubahan tersebut dan status tetap "live". Fitur ini akan menambahkan mekanisme polling untuk memeriksa status broadcast di YouTube dan memperbarui status stream lokal secara otomatis.

## Glossary

- **YouTube Status Sync System**: Modul dalam aplikasi StreamFlow yang memonitor dan menyinkronkan status broadcast YouTube dengan status stream lokal
- **Broadcast Status**: Status lifecycle broadcast di YouTube (created, ready, testing, live, complete, revoked)
- **Stream Status**: Status stream di aplikasi StreamFlow (offline, scheduled, live)
- **Polling Interval**: Interval waktu antara setiap pengecekan status ke YouTube API
- **Live Stream**: Stream yang sedang aktif dengan status "live" di aplikasi

## Requirements

### Requirement 1

**User Story:** As a user, I want the application to automatically detect when my YouTube broadcast ends, so that the stream status in StreamFlow updates without manual intervention.

#### Acceptance Criteria

1. WHILE a stream has status "live" and platform is "YouTube" THEN the YouTube Status Sync System SHALL periodically check the broadcast status via YouTube API
2. WHEN the YouTube broadcast status changes to "complete" or "revoked" THEN the YouTube Status Sync System SHALL stop the local FFmpeg process and update stream status to "offline" or "scheduled" (for recurring streams)
3. WHEN the YouTube broadcast is deleted THEN the YouTube Status Sync System SHALL stop the local FFmpeg process and update stream status appropriately
4. WHEN checking broadcast status THEN the YouTube Status Sync System SHALL use a polling interval of 60 seconds to balance API quota usage and responsiveness
5. IF the YouTube API returns an error during status check THEN the YouTube Status Sync System SHALL log the error and retry on the next polling interval without crashing

### Requirement 2

**User Story:** As a user, I want to see the real-time YouTube broadcast status in the application, so that I know the actual state of my stream on YouTube.

#### Acceptance Criteria

1. WHEN displaying a live YouTube stream THEN the YouTube Status Sync System SHALL show the current YouTube broadcast lifecycle status (testing, live, complete)
2. WHEN the broadcast status is "testing" THEN the YouTube Status Sync System SHALL display "Menunggu Preview" indicator
3. WHEN the broadcast status is "live" THEN the YouTube Status Sync System SHALL display "Live di YouTube" indicator
4. WHEN the broadcast status is "complete" THEN the YouTube Status Sync System SHALL display "Selesai" indicator
5. WHEN the broadcast status cannot be determined THEN the YouTube Status Sync System SHALL display "Status tidak diketahui" indicator

### Requirement 3

**User Story:** As a user, I want the sync to work only for YouTube streams with valid credentials, so that non-YouTube streams are not affected.

#### Acceptance Criteria

1. WHEN a stream starts with platform "YouTube" THEN the YouTube Status Sync System SHALL check if the user has valid YouTube credentials
2. IF the user has valid YouTube credentials THEN the YouTube Status Sync System SHALL attempt to find the matching broadcast by stream key
3. IF no matching broadcast is found THEN the YouTube Status Sync System SHALL continue streaming without sync (manual RTMP mode)
4. WHEN a stream starts with platform other than "YouTube" THEN the YouTube Status Sync System SHALL not perform any YouTube status checks

### Requirement 4

**User Story:** As a user, I want the application to handle YouTube API quota limits gracefully, so that the sync feature does not cause errors.

#### Acceptance Criteria

1. WHEN YouTube API returns quota exceeded error THEN the YouTube Status Sync System SHALL disable status checking for 1 hour
2. WHEN quota limit period expires THEN the YouTube Status Sync System SHALL resume normal status checking
3. WHEN API quota is exceeded THEN the YouTube Status Sync System SHALL log a warning message indicating quota status
4. WHILE quota is exceeded THEN the YouTube Status Sync System SHALL continue streaming without status sync

