# Requirements Document

## Introduction

Fitur ini memungkinkan admin untuk membatasi kapasitas storage (penyimpanan) setiap user dalam sistem. Admin dapat mengatur batas maksimum storage yang dapat digunakan oleh setiap user untuk menyimpan file video dan audio. Sistem akan menghitung total penggunaan storage user dan mencegah upload file baru jika batas sudah tercapai.

## Glossary

- **Storage Limit**: Batas maksimum kapasitas penyimpanan dalam bytes yang dapat digunakan oleh seorang user
- **Storage Usage**: Total ukuran file (video + audio) yang telah diupload oleh user
- **Admin**: User dengan role 'admin' yang memiliki hak untuk mengatur storage limit user lain
- **Member**: User dengan role 'member' yang storage-nya dapat dibatasi oleh admin
- **System**: Aplikasi StreamFlow yang mengelola streaming dan media

## Requirements

### Requirement 1

**User Story:** As an admin, I want to set storage limits for each user, so that I can control disk space usage and prevent any single user from consuming excessive storage.

#### Acceptance Criteria

1. WHEN an admin accesses the user management page THEN the System SHALL display the current storage limit and usage for each user
2. WHEN an admin sets a storage limit for a user THEN the System SHALL save the limit value in bytes to the database
3. WHEN an admin sets a storage limit to null or zero THEN the System SHALL treat the user as having unlimited storage
4. WHERE a user has a custom storage limit THEN the System SHALL enforce that limit during file uploads

### Requirement 2

**User Story:** As a system, I want to calculate and track storage usage per user, so that storage limits can be enforced accurately.

#### Acceptance Criteria

1. WHEN calculating storage usage THEN the System SHALL sum the file_size of all videos and audios owned by the user
2. WHEN a file is uploaded or deleted THEN the System SHALL recalculate the user's storage usage
3. WHEN querying storage usage THEN the System SHALL return the total in bytes along with a human-readable format

### Requirement 3

**User Story:** As a user, I want to see my storage usage and limit, so that I can manage my uploads accordingly.

#### Acceptance Criteria

1. WHEN a user views the gallery or dashboard THEN the System SHALL display the current storage usage
2. WHERE a user has a storage limit THEN the System SHALL display both usage and limit with percentage used
3. WHEN storage usage exceeds 80% of the limit THEN the System SHALL display a warning indicator
4. WHEN storage usage reaches 100% of the limit THEN the System SHALL display a critical indicator

### Requirement 4

**User Story:** As a system, I want to prevent uploads that would exceed storage limits, so that disk space is protected.

#### Acceptance Criteria

1. WHEN a user attempts to upload a file THEN the System SHALL check if the upload would exceed the storage limit
2. IF the upload would exceed the storage limit THEN the System SHALL reject the upload with a clear error message
3. WHEN an upload is rejected due to storage limit THEN the System SHALL inform the user of their current usage and limit
4. WHERE a user has unlimited storage (null limit) THEN the System SHALL allow all uploads without storage checks

### Requirement 5

**User Story:** As an admin, I want to set a default storage limit for new users, so that I don't have to configure each user individually.

#### Acceptance Criteria

1. WHEN a new user is created THEN the System SHALL apply the default storage limit from system settings
2. WHEN an admin updates the default storage limit THEN the System SHALL save it to system settings
3. WHERE no default storage limit is configured THEN the System SHALL treat new users as having unlimited storage
