# Requirements Document

## Introduction

YouTube Sync adalah fitur sederhana untuk membuat scheduled live broadcasts di YouTube langsung dari aplikasi StreamFlow. User cukup memasukkan API credentials (Client ID, Client Secret, Refresh Token) satu kali, lalu bisa langsung menjadwalkan live stream tanpa perlu buka YouTube Studio.

## Glossary

- **YouTube Sync System**: Modul dalam aplikasi StreamFlow yang menangani integrasi dengan YouTube Live Streaming API
- **API Credentials**: Client ID, Client Secret, dan Refresh Token yang didapat dari Google Cloud Console
- **Broadcast**: Live stream event di YouTube yang dapat dijadwalkan untuk waktu tertentu
- **Stream Key**: Kunci unik yang digunakan untuk mengirim video stream ke YouTube
- **Privacy Status**: Pengaturan visibilitas broadcast (public, unlisted, private)

## Requirements

### Requirement 1

**User Story:** As a user, I want to save my YouTube API credentials, so that I can create scheduled broadcasts from StreamFlow.

#### Acceptance Criteria

1. WHEN a user navigates to the YouTube Sync page without saved credentials THEN the YouTube Sync System SHALL display a credentials input form
2. WHEN a user enters Client ID, Client Secret, and Refresh Token THEN the YouTube Sync System SHALL validate the credentials by testing API connection
3. WHEN credentials are valid THEN the YouTube Sync System SHALL store the credentials securely and display the connected channel name
4. WHEN a user clicks "Remove Credentials" THEN the YouTube Sync System SHALL delete stored credentials from the database
5. IF credentials are invalid THEN the YouTube Sync System SHALL display an error message

### Requirement 2

**User Story:** As a user, I want to create scheduled live broadcasts on YouTube directly from StreamFlow, so that I can prepare my streams in advance.

#### Acceptance Criteria

1. WHEN a user clicks "Create Broadcast" button THEN the YouTube Sync System SHALL display a form with fields for title, description, scheduled start time, privacy status, and thumbnail upload
2. WHEN a user submits a valid broadcast form THEN the YouTube Sync System SHALL create a broadcast via YouTube API and retrieve the stream key
3. WHEN a user uploads a thumbnail THEN the YouTube Sync System SHALL upload the thumbnail to YouTube via API
4. WHEN broadcast creation is successful THEN the YouTube Sync System SHALL display the new broadcast with its stream key and thumbnail in the list
5. IF broadcast creation fails THEN the YouTube Sync System SHALL display an error message with the failure reason
6. WHEN creating a broadcast THEN the YouTube Sync System SHALL validate that scheduled start time is at least 10 minutes in the future
7. WHEN uploading thumbnail THEN the YouTube Sync System SHALL validate that the image is JPG or PNG format and maximum 2MB size

### Requirement 3

**User Story:** As a user, I want to view and manage my scheduled broadcasts, so that I can see what streams are planned.

#### Acceptance Criteria

1. WHEN a user visits the YouTube Sync page with valid credentials THEN the YouTube Sync System SHALL display all upcoming broadcasts
2. WHEN displaying broadcasts THEN the YouTube Sync System SHALL show title, scheduled time, privacy status, stream key, thumbnail, and status
3. WHEN a user clicks "Change Thumbnail" on a broadcast THEN the YouTube Sync System SHALL allow uploading a new thumbnail image
4. WHEN a new thumbnail is uploaded THEN the YouTube Sync System SHALL update the thumbnail via YouTube API
5. WHEN a user clicks delete on a broadcast THEN the YouTube Sync System SHALL delete the broadcast via YouTube API after confirmation
6. WHEN the broadcasts list is empty THEN the YouTube Sync System SHALL display a message indicating no scheduled broadcasts

### Requirement 4

**User Story:** As a user, I want the YouTube Sync page to be accessible from the sidebar, so that I can easily navigate to manage my YouTube broadcasts.

#### Acceptance Criteria

1. WHEN the application loads THEN the YouTube Sync System SHALL display a "YouTube" menu item in the sidebar with YouTube icon
2. WHEN a user clicks the YouTube menu item THEN the YouTube Sync System SHALL navigate to the YouTube Sync page
3. WHEN on the YouTube Sync page THEN the YouTube Sync System SHALL highlight the YouTube menu item as active
4. WHEN displaying the sidebar on mobile THEN the YouTube Sync System SHALL show the YouTube menu item in the bottom navigation
