# Requirements Document

## Introduction

Fitur ini menambahkan pengaturan sistem yang memungkinkan admin untuk mengaktifkan auto-approve pada registrasi user baru dan mengatur default live limit. Ketika auto-approve diaktifkan, user yang mendaftar akan langsung memiliki status "active" tanpa perlu menunggu approval manual dari admin. Admin juga dapat mengatur default live limit dimana nilai 0 berarti unlimited. Pengaturan ini dapat diakses melalui halaman Settings oleh admin.

## Glossary

- **System**: Aplikasi StreamFlow yang mengelola live streaming
- **Admin**: User dengan role admin yang memiliki akses penuh ke sistem
- **Member**: User dengan role member yang memiliki akses terbatas
- **Auto-Approve**: Fitur yang secara otomatis mengaktifkan akun user baru saat registrasi
- **Registration**: Proses pembuatan akun baru melalui halaman signup
- **System Settings**: Konfigurasi global sistem yang disimpan di database
- **Live Limit**: Batas maksimum jumlah live streaming simultan yang diizinkan untuk user
- **Unlimited Live**: Kondisi dimana user tidak memiliki batasan jumlah live streaming (live_limit = 0)

## Requirements

### Requirement 1

**User Story:** As an admin, I want to configure auto-approve setting and default live limit for new user registrations, so that I can control user activation and streaming limits from a central location.

#### Acceptance Criteria

1. WHEN an admin accesses the Settings page THEN the System SHALL display an auto-approve toggle option in the user management section
2. WHEN an admin enables the auto-approve setting THEN the System SHALL save the setting value as "enabled" in the system_settings table
3. WHEN an admin disables the auto-approve setting THEN the System SHALL save the setting value as "disabled" in the system_settings table
4. WHEN the auto-approve setting is changed THEN the System SHALL display a success notification confirming the change
5. WHEN an admin accesses the Settings page THEN the System SHALL display a default live limit input field
6. WHEN an admin sets the default live limit to 0 THEN the System SHALL treat this as unlimited live streaming for new users
7. WHEN an admin sets the default live limit to a number greater than 0 THEN the System SHALL apply this limit to new user registrations
8. WHEN the default live limit setting is changed THEN the System SHALL display a success notification confirming the change

### Requirement 2

**User Story:** As a new user, I want my account to be automatically activated when auto-approve is enabled, so that I can immediately access the system after registration.

#### Acceptance Criteria

1. WHEN a user registers and auto-approve is enabled THEN the System SHALL create the user account with status "active"
2. WHEN a user registers and auto-approve is disabled THEN the System SHALL create the user account with status "inactive"
3. WHEN a user registers with auto-approve enabled THEN the System SHALL display a success message indicating immediate access
4. WHEN a user registers with auto-approve disabled THEN the System SHALL display a message indicating admin approval is required
5. WHEN a user registers THEN the System SHALL apply the default live limit setting to the new user account
6. WHEN a user registers and default live limit is 0 THEN the System SHALL set the user live_limit to NULL representing unlimited

### Requirement 3

**User Story:** As a system administrator, I want the auto-approve and live limit settings to have sensible defaults, so that the system behaves predictably on fresh installations.

#### Acceptance Criteria

1. WHEN the system is freshly installed THEN the System SHALL default the auto-approve setting to "disabled" for security
2. WHEN the auto-approve setting does not exist in database THEN the System SHALL treat the setting as "disabled"
3. WHEN the system is freshly installed THEN the System SHALL default the live limit to 0 representing unlimited
4. WHEN the default live limit setting does not exist in database THEN the System SHALL treat the setting as 0 representing unlimited
