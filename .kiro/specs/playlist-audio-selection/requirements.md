# Requirements Document

## Introduction

Fitur ini menambahkan kemampuan untuk memilih audio selain video dalam playlist. UI akan menggunakan sistem tab untuk memisahkan pemilihan Video dan Audio secara efisien. Layout dibagi menjadi dua kolom: kolom kiri untuk available media (dengan tab Video/Audio) dan kolom kanan untuk selected media (dengan tab Playlist Videos/Playlist Audios).

## Glossary

- **Playlist**: Kumpulan media (video dan/atau audio) yang dapat diputar secara berurutan atau acak untuk streaming
- **Audio**: File audio yang tersimpan di gallery yang dapat ditambahkan ke playlist
- **Video**: File video yang tersimpan di gallery yang dapat ditambahkan ke playlist
- **Playlist Modal**: Dialog popup untuk membuat atau mengedit playlist
- **Media Tab**: Tab untuk switch antara tampilan Video dan Audio
- **Available Media**: Daftar video/audio yang tersedia untuk dipilih (kolom kiri)
- **Selected Media**: Daftar video/audio yang sudah dipilih (kolom kanan)

## Requirements

### Requirement 1

**User Story:** As a user, I want to switch between video and audio selection using tabs, so that I can efficiently select different media types.

#### Acceptance Criteria

1. WHEN a user opens the create/edit playlist modal THEN the Playlist_Modal SHALL display two tabs "Videos" and "Audios" on the left column (Available Media)
2. WHEN a user clicks the "Videos" tab THEN the Playlist_Modal SHALL display the list of available videos
3. WHEN a user clicks the "Audios" tab THEN the Playlist_Modal SHALL display the list of available audios
4. WHEN switching tabs THEN the Playlist_Modal SHALL maintain the search functionality specific to each tab

### Requirement 2

**User Story:** As a user, I want to see selected videos and audios in separate tabs on the right column, so that I can manage each media type independently.

#### Acceptance Criteria

1. WHEN the playlist modal is open THEN the Playlist_Modal SHALL display two tabs "Playlist Videos" and "Playlist Audios" on the right column (Selected Media)
2. WHEN a user clicks "Playlist Videos" tab THEN the Playlist_Modal SHALL display the list of selected videos
3. WHEN a user clicks "Playlist Audios" tab THEN the Playlist_Modal SHALL display the list of selected audios
4. WHEN no media is selected in a tab THEN the Playlist_Modal SHALL display appropriate empty state message

### Requirement 3

**User Story:** As a user, I want to add and remove audios from playlist, so that I can customize my playlist content.

#### Acceptance Criteria

1. WHEN a user clicks on an available audio THEN the Playlist_Modal SHALL add the audio to the selected audios list
2. WHEN a user clicks remove on a selected audio THEN the Playlist_Modal SHALL remove the audio from the selected list
3. WHEN an audio is added to selected list THEN the Playlist_Modal SHALL remove it from available list
4. WHEN an audio is removed from selected list THEN the Playlist_Modal SHALL return it to available list
5. WHEN a user drags and drops selected audios THEN the Playlist_Modal SHALL reorder the audios according to the new position

### Requirement 4

**User Story:** As a user, I want to save playlists with both videos and audios, so that my playlist contains all selected media.

#### Acceptance Criteria

1. WHEN a user submits the playlist form with selected audios THEN the System SHALL save the audio associations to the database
2. WHEN a user edits an existing playlist THEN the Playlist_Modal SHALL load and display previously selected audios in the appropriate tab
3. WHEN a user views a playlist THEN the View_Playlist_Modal SHALL display both videos and audios with clear separation

### Requirement 5

**User Story:** As a user, I want the playlist card to show audio count, so that I can see how many audios are in each playlist.

#### Acceptance Criteria

1. WHEN displaying playlist cards THEN the Playlist_Card SHALL show both video count and audio count
2. WHEN a playlist has audios THEN the Playlist_Card SHALL display the audio count with music icon
