# Requirements Document

## Introduction

Fitur ini memungkinkan user untuk menghubungkan multiple akun YouTube ke sistem StreamFlow Lite. Saat ini sistem hanya mendukung satu akun YouTube per user. Dengan fitur ini, user dapat menambahkan beberapa akun YouTube, memilih akun mana yang akan digunakan untuk membuat broadcast, dan mengelola semua akun YouTube yang terhubung.

## Glossary

- **YouTube Account**: Akun YouTube yang terhubung ke sistem melalui OAuth credentials (Client ID, Client Secret, Refresh Token)
- **YouTube Credentials**: Data autentikasi yang diperlukan untuk mengakses YouTube API (Client ID, Client Secret, Refresh Token)
- **Channel**: Channel YouTube yang terkait dengan akun YouTube yang terhubung
- **Broadcast**: Siaran langsung (live stream) yang dijadwalkan di YouTube
- **Active Account**: Akun YouTube yang sedang dipilih/aktif untuk digunakan dalam operasi
- **Primary Account**: Akun YouTube default yang digunakan jika tidak ada akun lain yang dipilih

## Requirements

### Requirement 1

**User Story:** As a user, I want to connect multiple YouTube accounts to my StreamFlow account, so that I can manage broadcasts for different channels from one place.

#### Acceptance Criteria

1. WHEN a user adds a new YouTube account THEN the System SHALL validate the credentials and store them with a unique identifier
2. WHEN a user has existing YouTube accounts connected THEN the System SHALL allow adding additional accounts without removing existing ones
3. WHEN credentials validation fails THEN the System SHALL display a specific error message indicating the validation failure reason
4. WHEN a user views the YouTube page THEN the System SHALL display all connected YouTube accounts with their channel names

### Requirement 2

**User Story:** As a user, I want to select which YouTube account to use when creating a broadcast, so that I can stream to the correct channel.

#### Acceptance Criteria

1. WHEN a user opens the create broadcast modal THEN the System SHALL display a dropdown to select from connected YouTube accounts
2. WHEN a user selects a YouTube account THEN the System SHALL load the stream keys associated with that account
3. WHEN only one YouTube account is connected THEN the System SHALL automatically select that account
4. WHEN creating a broadcast THEN the System SHALL use the selected YouTube account's credentials

### Requirement 3

**User Story:** As a user, I want to manage my connected YouTube accounts, so that I can remove accounts I no longer need.

#### Acceptance Criteria

1. WHEN a user clicks disconnect on a YouTube account THEN the System SHALL remove only that account's credentials
2. WHEN a user disconnects an account THEN the System SHALL display a confirmation dialog before removing
3. WHEN the last YouTube account is disconnected THEN the System SHALL show the connect account form
4. WHEN a YouTube account is disconnected THEN the System SHALL preserve other connected accounts

### Requirement 4

**User Story:** As a user, I want to see which YouTube account each broadcast belongs to, so that I can track my scheduled streams across channels.

#### Acceptance Criteria

1. WHEN displaying scheduled broadcasts THEN the System SHALL show the channel name for each broadcast
2. WHEN listing broadcasts THEN the System SHALL group or filter broadcasts by YouTube account
3. WHEN a broadcast is created THEN the System SHALL store the associated YouTube account identifier

### Requirement 5

**User Story:** As a user, I want to edit existing broadcasts, so that I can update the title, description, schedule time, or other settings without recreating the broadcast.

#### Acceptance Criteria

1. WHEN a user clicks edit on a broadcast THEN the System SHALL display a form pre-filled with the current broadcast settings
2. WHEN a user submits edited broadcast details THEN the System SHALL update the broadcast on YouTube via API
3. WHEN editing a broadcast THEN the System SHALL allow changing title, description, scheduled time, privacy status, and thumbnail
4. WHEN a broadcast update fails THEN the System SHALL display an error message and preserve the original settings
5. WHEN a broadcast is successfully updated THEN the System SHALL refresh the broadcast list to show updated information

### Requirement 6

**User Story:** As a user, I want to reuse an existing broadcast configuration as a template, so that I can quickly create similar broadcasts without entering all details again.

#### Acceptance Criteria

1. WHEN a user clicks reuse on a broadcast THEN the System SHALL open the create broadcast form pre-filled with that broadcast's settings
2. WHEN reusing a broadcast THEN the System SHALL copy title, description, privacy status, tags, and category
3. WHEN reusing a broadcast THEN the System SHALL require the user to set a new scheduled time
4. WHEN reusing a broadcast THEN the System SHALL allow the user to select a different YouTube account
5. WHEN the reused broadcast is submitted THEN the System SHALL create a new broadcast with the modified settings
