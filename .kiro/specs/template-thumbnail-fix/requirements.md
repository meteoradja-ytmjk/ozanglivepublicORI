# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan untuk masalah thumbnail yang tidak tersimpan ketika template broadcast digunakan kembali (re-create) atau dijadwalkan ulang melalui recurring schedule. Saat ini, ketika template dengan thumbnail di-schedule ulang melalui `scheduleService`, thumbnail tidak di-upload ke YouTube broadcast yang baru dibuat.

## Glossary

- **BroadcastTemplate**: Model yang menyimpan konfigurasi template broadcast termasuk thumbnail_path
- **ScheduleService**: Service yang menjalankan recurring broadcast secara otomatis
- **YouTubeService**: Service untuk berinteraksi dengan YouTube API termasuk upload thumbnail
- **Thumbnail**: Gambar preview yang ditampilkan untuk broadcast di YouTube
- **Recurring Broadcast**: Broadcast yang dijadwalkan untuk dibuat secara otomatis berdasarkan pola (daily/weekly)

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin thumbnail dari template tersimpan dan digunakan ketika broadcast dibuat ulang dari template, sehingga broadcast baru memiliki tampilan yang konsisten dengan template asli.

#### Acceptance Criteria

1. WHEN scheduleService executes a template with thumbnail_path THEN the system SHALL upload the thumbnail to the newly created YouTube broadcast
2. WHEN a multi-broadcast template is executed THEN the system SHALL upload the corresponding thumbnail for each broadcast that has a thumbnail defined
3. IF the thumbnail file does not exist at the specified path THEN the system SHALL log a warning and continue creating the broadcast without thumbnail
4. WHEN thumbnail upload fails due to YouTube API error THEN the system SHALL log the error and continue without failing the entire broadcast creation

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin melihat thumbnail yang tersimpan di template saat melihat daftar template, sehingga saya dapat memverifikasi bahwa thumbnail sudah benar.

#### Acceptance Criteria

1. WHEN displaying template list THEN the system SHALL show the thumbnail preview if thumbnail_path exists
2. WHEN template has no thumbnail THEN the system SHALL display a default placeholder image

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin multi-broadcast template menyimpan thumbnail untuk setiap broadcast individual, sehingga setiap broadcast dapat memiliki thumbnail yang berbeda.

#### Acceptance Criteria

1. WHEN saving a multi-broadcast template THEN the system SHALL store thumbnail path for each individual broadcast in the broadcasts JSON array
2. WHEN executing multi-broadcast template THEN the system SHALL upload the correct thumbnail for each broadcast based on its stored thumbnail path
