# Requirements Document

## Introduction

Fitur ini menambahkan kemampuan untuk memilih stream key yang sudah ada di YouTube Dashboard saat membuat broadcast baru. Saat ini, sistem selalu membuat stream key baru secara otomatis. Dengan fitur ini, pengguna dapat memilih dari daftar stream key yang sudah dibuat sebelumnya di YouTube Studio, sehingga lebih fleksibel dan sesuai dengan workflow yang sudah ada.

## Glossary

- **Stream_Key_Selector**: Komponen UI dropdown yang menampilkan daftar stream key yang tersedia dari YouTube
- **YouTube_Live_Stream**: Objek stream di YouTube yang berisi informasi ingestion (stream key dan RTMP URL)
- **Broadcast_Creator**: Modul yang menangani pembuatan broadcast baru dengan opsi pemilihan stream key
- **Stream_Key**: Kunci unik yang digunakan untuk mengirim video stream ke YouTube via RTMP
- **Thumbnail_Gallery**: Komponen UI yang menampilkan grid gambar thumbnail yang sudah diupload sebelumnya
- **Broadcast_Creator**: Modul yang menangani pembuatan broadcast termasuk pemilihan thumbnail

## Requirements

### Requirement 1

**User Story:** As a user, I want to see a list of existing stream keys from my YouTube account when creating a broadcast, so that I can reuse stream keys that I have already configured in YouTube Studio.

#### Acceptance Criteria

1. WHEN the create broadcast modal opens THEN the Stream_Key_Selector SHALL fetch and display all available YouTube_Live_Stream entries from the user's YouTube account
2. WHEN the YouTube API returns stream keys THEN the Stream_Key_Selector SHALL display each stream key with its title and stream name
3. WHEN no existing stream keys are found THEN the Stream_Key_Selector SHALL display an option to create a new stream key automatically
4. IF the YouTube API fails to fetch stream keys THEN the Broadcast_Creator SHALL display an error message and allow retry

### Requirement 2

**User Story:** As a user, I want to select an existing stream key or create a new one when creating a broadcast, so that I have flexibility in how I configure my streams.

#### Acceptance Criteria

1. WHEN a user selects an existing stream key THEN the Broadcast_Creator SHALL bind that stream to the new broadcast without creating a new stream
2. WHEN a user selects "Create new stream key" option THEN the Broadcast_Creator SHALL create a new YouTube_Live_Stream and bind it to the broadcast
3. WHEN a broadcast is created with an existing stream key THEN the system SHALL return the selected stream key and RTMP URL in the response

### Requirement 3

**User Story:** As a user, I want the stream key selector to show relevant information about each stream, so that I can easily identify which stream key to use.

#### Acceptance Criteria

1. WHEN displaying stream keys THEN the Stream_Key_Selector SHALL show the stream title as the primary identifier
2. WHEN displaying stream keys THEN the Stream_Key_Selector SHALL show the stream resolution and frame rate as secondary information
3. WHEN a stream key is selected THEN the Stream_Key_Selector SHALL provide visual feedback indicating the selection

### Requirement 4

**User Story:** As a user, I want to select a thumbnail from my uploaded images gallery when creating a broadcast, so that I can reuse existing thumbnails without uploading again.

#### Acceptance Criteria

1. WHEN the create broadcast modal opens THEN the Thumbnail_Gallery SHALL display all previously uploaded thumbnail images from the uploads/thumbnails folder
2. WHEN a user clicks on a thumbnail in the gallery THEN the Broadcast_Creator SHALL select that image as the broadcast thumbnail
3. WHEN a thumbnail is selected from gallery THEN the Broadcast_Creator SHALL display a visual indicator on the selected thumbnail
4. WHEN a user wants to upload a new thumbnail THEN the Broadcast_Creator SHALL provide an option to upload alongside the gallery selection
5. WHEN creating a broadcast with a gallery thumbnail THEN the system SHALL use the selected image file for the YouTube thumbnail upload

