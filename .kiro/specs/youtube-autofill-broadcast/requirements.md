# Requirements Document

## Introduction

Fitur ini bertujuan untuk menyederhanakan proses pembuatan broadcast YouTube dengan mengisi otomatis field title, description, tags, dan stream key dari data YouTube Dashboard. Field category akan dihilangkan karena tidak diperlukan. Tampilan form akan disamakan antara mode desktop dan mobile untuk konsistensi pengalaman pengguna.

## Glossary

- **YouTube Dashboard**: Panel kontrol YouTube Studio yang berisi pengaturan default channel
- **Broadcast Form**: Form untuk membuat scheduled broadcast di aplikasi StreamFlow
- **Stream Key**: Kunci unik yang digunakan untuk streaming ke YouTube
- **Auto-fill**: Pengisian otomatis field form berdasarkan data dari YouTube API
- **Channel Defaults**: Pengaturan default yang dikonfigurasi di YouTube Studio untuk channel

## Requirements

### Requirement 1

**User Story:** As a user, I want the broadcast form to auto-fill title, description, and tags from my YouTube channel defaults, so that I don't have to manually enter repetitive information.

#### Acceptance Criteria

1. WHEN a user opens the create broadcast modal THEN the System SHALL fetch channel default settings from YouTube API
2. WHEN channel defaults are successfully retrieved THEN the System SHALL populate the title field with the default title if available
3. WHEN channel defaults are successfully retrieved THEN the System SHALL populate the description field with the default description if available
4. WHEN channel defaults are successfully retrieved THEN the System SHALL populate the tags field with the default tags if available
5. WHEN auto-fill is in progress THEN the System SHALL display a loading indicator on the affected fields
6. WHEN auto-fill completes successfully THEN the System SHALL display an "Auto-filled" indicator next to the populated fields
7. IF the YouTube API request fails THEN the System SHALL allow manual input without blocking the form

### Requirement 2

**User Story:** As a user, I want to select from existing stream keys loaded from my YouTube Dashboard, so that I can reuse my configured stream keys.

#### Acceptance Criteria

1. WHEN a user opens the create broadcast modal THEN the System SHALL fetch available stream keys from YouTube API
2. WHEN stream keys are being loaded THEN the System SHALL display a loading spinner in the stream key dropdown
3. WHEN stream keys are successfully retrieved THEN the System SHALL populate the dropdown with available stream keys
4. WHEN displaying stream keys THEN the System SHALL show stream title, resolution, and frame rate for each option
5. WHEN no stream keys exist THEN the System SHALL display "Create new stream key" as the only option
6. IF the stream key fetch fails THEN the System SHALL display "Create new stream key" option and allow form submission

### Requirement 3

**User Story:** As a user, I want the category field removed from the broadcast form, so that the form is simpler and focuses on essential fields.

#### Acceptance Criteria

1. WHEN the create broadcast modal is displayed THEN the System SHALL NOT display the category field
2. WHEN the edit broadcast modal is displayed THEN the System SHALL NOT display the category field
3. WHEN creating a broadcast THEN the System SHALL use a default category value internally

### Requirement 4

**User Story:** As a mobile user, I want the broadcast form to have the same layout and functionality as the desktop version, so that I have a consistent experience across devices.

#### Acceptance Criteria

1. WHEN the create broadcast modal is displayed on mobile THEN the System SHALL display all fields in the same order as desktop
2. WHEN the create broadcast modal is displayed on mobile THEN the System SHALL display the same auto-fill indicators as desktop
3. WHEN the create broadcast modal is displayed on mobile THEN the System SHALL display the stream key dropdown with the same options as desktop
4. WHEN interacting with form fields on mobile THEN the System SHALL provide touch-friendly input sizes with minimum 44px touch targets
5. WHEN the modal is displayed on mobile THEN the System SHALL be scrollable to access all form fields

### Requirement 5

**User Story:** As a user, I want to switch between YouTube accounts and have the form auto-fill with the selected account's defaults, so that I can easily create broadcasts for different channels.

#### Acceptance Criteria

1. WHEN a user changes the selected YouTube account THEN the System SHALL fetch channel defaults for the newly selected account
2. WHEN a user changes the selected YouTube account THEN the System SHALL fetch stream keys for the newly selected account
3. WHEN account-specific data is loading THEN the System SHALL display loading indicators on affected fields
4. WHEN account change completes THEN the System SHALL update all auto-filled fields with the new account's data
