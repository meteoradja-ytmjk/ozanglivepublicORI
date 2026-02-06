# Requirements Document

## Introduction

Fitur ini menambahkan kemampuan upload audio ke panel Gallery yang sudah ada, dengan memisahkan konten video dan audio ke dalam tab terpisah. Pengguna dapat mengelola file video dan audio secara terorganisir dalam satu halaman gallery dengan navigasi tab yang intuitif.

## Glossary

- **Gallery_System**: Sistem panel gallery yang menampilkan dan mengelola media (video dan audio) pengguna
- **Audio_File**: File audio yang diupload pengguna dengan format MP3, WAV, atau AAC
- **Video_File**: File video yang diupload pengguna dengan format MP4, AVI, atau MOV
- **Tab_Navigation**: Komponen UI untuk berpindah antara tampilan video dan audio
- **Media_Card**: Komponen UI yang menampilkan informasi media (thumbnail, judul, durasi, ukuran)
- **Upload_Modal**: Dialog modal untuk mengupload file media baru

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload audio files to the gallery, so that I can manage and stream audio content alongside my videos.

#### Acceptance Criteria

1. WHEN a user clicks the "Upload Audio" button THEN the Gallery_System SHALL display an upload modal that accepts audio files with formats MP3, WAV, and AAC
2. WHEN a user selects valid audio files THEN the Gallery_System SHALL upload the files and store metadata including title, duration, file size, and format
3. WHEN a user attempts to upload an invalid audio format THEN the Gallery_System SHALL reject the upload and display an error message specifying allowed formats
4. WHEN an audio file upload completes successfully THEN the Gallery_System SHALL display a success notification and add the audio to the audio list

### Requirement 2

**User Story:** As a user, I want to switch between video and audio tabs in the gallery, so that I can view and manage each media type separately.

#### Acceptance Criteria

1. WHEN a user visits the gallery page THEN the Gallery_System SHALL display tab navigation with "Videos" and "Audio" options
2. WHEN a user clicks the "Videos" tab THEN the Gallery_System SHALL display only video files in the gallery grid
3. WHEN a user clicks the "Audio" tab THEN the Gallery_System SHALL display only audio files in the gallery grid
4. WHEN a user switches tabs THEN the Gallery_System SHALL preserve the active tab state and update the URL query parameter
5. WHEN a user loads the gallery with a tab query parameter THEN the Gallery_System SHALL activate the corresponding tab

### Requirement 3

**User Story:** As a user, I want to see audio files displayed with relevant information, so that I can identify and manage my audio content easily.

#### Acceptance Criteria

1. WHEN displaying an audio file card THEN the Gallery_System SHALL show the audio title, duration, file size, and upload date
2. WHEN displaying an audio file card THEN the Gallery_System SHALL show a default audio icon or waveform thumbnail
3. WHEN a user hovers over an audio card THEN the Gallery_System SHALL display a play button overlay

### Requirement 4

**User Story:** As a user, I want to play audio files directly from the gallery, so that I can preview audio content without leaving the page.

#### Acceptance Criteria

1. WHEN a user clicks the play button on an audio card THEN the Gallery_System SHALL open an audio player modal with playback controls
2. WHEN the audio player modal is open THEN the Gallery_System SHALL display the audio title and provide play, pause, and seek controls
3. WHEN a user closes the audio player modal THEN the Gallery_System SHALL stop audio playback and return to the gallery view

### Requirement 5

**User Story:** As a user, I want to rename and delete audio files, so that I can manage my audio library effectively.

#### Acceptance Criteria

1. WHEN a user clicks the rename button on an audio card THEN the Gallery_System SHALL display a rename dialog with the current title pre-filled
2. WHEN a user submits a new title THEN the Gallery_System SHALL update the audio title and display a success notification
3. WHEN a user clicks the delete button on an audio card THEN the Gallery_System SHALL display a confirmation dialog
4. WHEN a user confirms deletion THEN the Gallery_System SHALL remove the audio file and its metadata, then display a success notification

### Requirement 6

**User Story:** As a user, I want to search and sort audio files, so that I can find specific audio content quickly.

#### Acceptance Criteria

1. WHEN a user types in the search field on the Audio tab THEN the Gallery_System SHALL filter audio files by title matching the search query
2. WHEN a user selects a sort option THEN the Gallery_System SHALL reorder audio files according to the selected criteria (newest, oldest)
