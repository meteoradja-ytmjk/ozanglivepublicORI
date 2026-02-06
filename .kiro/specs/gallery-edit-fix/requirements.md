# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan untuk tiga bug yang ditemukan pada aplikasi StreamFlow:
1. Durasi stream tidak berubah ketika di-edit
2. Icon pada action buttons selalu hilang (tidak terlihat)
3. Icon tombol tidak muncul warnanya pada mobile view

## Glossary

- **Stream**: Konfigurasi streaming yang berisi video, audio, durasi, dan pengaturan RTMP
- **Duration**: Durasi streaming dalam jam (stream_duration_hours)
- **Action Icons**: Icon-icon untuk tombol play/stop, edit, dan delete pada daftar stream
- **Tabler Icons**: Library icon yang digunakan aplikasi dengan prefix class `ti`
- **Mobile View**: Tampilan aplikasi pada layar dengan lebar kurang dari 768px

## Requirements

### Requirement 1

**User Story:** As a user, I want to edit stream duration, so that I can change how long my stream will run.

#### Acceptance Criteria

1. WHEN a user edits a stream and changes the duration value THEN the System SHALL save the new duration value to the database
2. WHEN a user opens the edit modal for an existing stream THEN the System SHALL display the current duration value in the duration input field
3. WHEN a user clears the duration field and saves THEN the System SHALL set the duration to null in the database

### Requirement 2

**User Story:** As a user, I want to see action icons on stream list, so that I can easily identify and click the play, edit, and delete buttons.

#### Acceptance Criteria

1. WHEN the stream list is rendered dynamically via JavaScript THEN the System SHALL ensure all Tabler icons have the `font-loaded` class applied
2. WHEN new stream items are added to the DOM THEN the System SHALL apply visibility styling to make icons visible immediately
3. WHEN the page loads THEN the System SHALL display all action icons (play/stop, edit, delete) with proper visibility

### Requirement 3

**User Story:** As a mobile user, I want to see colored action icons, so that I can distinguish between different actions (play=green, stop=red, edit=blue, delete=red).

#### Acceptance Criteria

1. WHEN viewing the stream list on mobile devices THEN the System SHALL display action icons with their designated colors (green for play, red for stop/delete, blue for edit)
2. WHEN the icon font loads on mobile THEN the System SHALL apply the `font-loaded` class to dynamically rendered icons
3. WHEN action buttons are rendered in mobile view THEN the System SHALL maintain consistent icon visibility and color styling
