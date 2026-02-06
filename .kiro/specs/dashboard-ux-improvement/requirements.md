# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan UX pada dashboard streaming untuk meningkatkan efisiensi pengelolaan stream. Fitur utama meliputi inline editing untuk kolom Schedule dan Duration, penghapusan konfirmasi delete untuk mempercepat workflow, filter nama stream untuk pengelompokan, dan fitur hapus semua backup.

## Glossary

- **Dashboard**: Halaman utama yang menampilkan daftar stream dan status sistem
- **Stream**: Konfigurasi streaming yang berisi informasi video, jadwal, dan durasi
- **Inline Edit**: Kemampuan mengedit nilai langsung pada tabel tanpa membuka modal
- **Schedule**: Jadwal streaming yang bisa berupa once, daily, atau weekly
- **Duration**: Durasi streaming dalam jam
- **Backup**: Fitur export/import konfigurasi stream dalam format JSON
- **Filter**: Mekanisme untuk menyaring dan mengelompokkan data berdasarkan kriteria tertentu

## Requirements

### Requirement 1

**User Story:** As a user, I want to edit schedule and duration directly in the table cells, so that I can quickly modify stream settings without opening the edit modal.

#### Acceptance Criteria

1. WHEN a user clicks on the Schedule cell in the stream table THEN the Dashboard SHALL display an inline edit interface with schedule type selector and time input
2. WHEN a user clicks on the Duration cell in the stream table THEN the Dashboard SHALL display an inline input field for entering duration in hours
3. WHEN a user modifies the inline schedule value and clicks outside or presses Enter THEN the Dashboard SHALL save the changes immediately via API
4. WHEN a user modifies the inline duration value and clicks outside or presses Enter THEN the Dashboard SHALL save the changes immediately via API
5. WHEN an inline edit save operation fails THEN the Dashboard SHALL revert to the original value and display an error notification
6. WHEN a user presses Escape during inline editing THEN the Dashboard SHALL cancel the edit and restore the original value

### Requirement 2

**User Story:** As a user, I want to delete streams without confirmation dialog, so that I can remove streams faster.

#### Acceptance Criteria

1. WHEN a user clicks the delete button on a stream THEN the Dashboard SHALL immediately delete the stream without showing a confirmation dialog
2. WHEN a stream is deleted successfully THEN the Dashboard SHALL display a success notification and refresh the stream list
3. WHEN a stream deletion fails THEN the Dashboard SHALL display an error notification with the failure reason

### Requirement 3

**User Story:** As a user, I want to filter streams by name using a dropdown filter, so that I can group and find streams more easily.

#### Acceptance Criteria

1. WHEN the Dashboard loads THEN the system SHALL replace the search input with a dropdown filter containing unique stream name prefixes
2. WHEN a user selects a filter option THEN the Dashboard SHALL display only streams matching the selected filter
3. WHEN a user selects "All Streams" option THEN the Dashboard SHALL display all streams without filtering
4. WHEN streams are added or removed THEN the Dashboard SHALL update the filter options to reflect current stream names

### Requirement 4

**User Story:** As a user, I want to delete all backup data at once, so that I can quickly clear all exported configurations.

#### Acceptance Criteria

1. WHEN a user opens the Backup dropdown menu THEN the Dashboard SHALL display a "Delete All" option alongside Export and Import
2. WHEN a user clicks "Delete All" in the Backup menu THEN the Dashboard SHALL delete all streams and display a success notification
3. WHEN the delete all operation fails THEN the Dashboard SHALL display an error notification with the failure reason
4. WHEN delete all completes successfully THEN the Dashboard SHALL refresh the stream list to show empty state
