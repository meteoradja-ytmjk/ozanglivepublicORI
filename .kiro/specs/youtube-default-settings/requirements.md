# Requirements Document

## Introduction

Fitur ini memungkinkan sistem untuk mengambil dan menggunakan default settings dari YouTube Live Dashboard secara otomatis saat membuat broadcast baru. Dengan fitur ini, pengguna tidak perlu mengisi ulang informasi seperti title, description, monetization status, altered content declaration, dan tags karena akan terisi otomatis sesuai dengan konfigurasi default di akun YouTube mereka.

## Glossary

- **YouTube_Sync_System**: Sistem yang mengelola integrasi dengan YouTube Live API untuk membuat dan mengelola broadcast
- **Default_Settings**: Konfigurasi default yang tersimpan di YouTube Live Dashboard pengguna (title template, description, monetization, altered content, tags)
- **Broadcast_Form**: Form untuk membuat broadcast baru di aplikasi
- **Monetization_Status**: Status monetisasi video (enabled/disabled) yang dikonfigurasi di YouTube
- **Altered_Content**: Deklarasi apakah konten mengandung materi yang diubah secara sintetis (AI-generated content)
- **Tags**: Kata kunci yang membantu YouTube mengkategorikan dan merekomendasikan video
- **Channel_Default**: Pengaturan default yang berlaku untuk semua video baru di channel YouTube

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin form broadcast terisi otomatis dengan default settings dari YouTube, sehingga saya tidak perlu mengisi informasi yang sama berulang kali.

#### Acceptance Criteria

1. WHEN the Broadcast_Form opens THEN the YouTube_Sync_System SHALL fetch Channel_Default settings from YouTube API
2. WHEN Channel_Default settings are successfully retrieved THEN the YouTube_Sync_System SHALL populate the title field with the default title template
3. WHEN Channel_Default settings are successfully retrieved THEN the YouTube_Sync_System SHALL populate the description field with the default description
4. WHEN Channel_Default settings retrieval fails THEN the YouTube_Sync_System SHALL display the form with empty fields and show a non-blocking warning message
5. WHEN the user modifies auto-filled fields THEN the YouTube_Sync_System SHALL use the user-modified values for broadcast creation

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin monetization status terisi otomatis sesuai default YouTube, sehingga pengaturan monetisasi konsisten dengan channel saya.

#### Acceptance Criteria

1. WHEN Channel_Default settings include monetization configuration THEN the YouTube_Sync_System SHALL display the Monetization_Status field with the default value
2. WHEN the channel has monetization enabled THEN the YouTube_Sync_System SHALL pre-select the monetization option based on channel default
3. WHEN the channel does not have monetization enabled THEN the YouTube_Sync_System SHALL hide or disable the Monetization_Status field

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin altered content declaration terisi otomatis, sehingga saya tidak perlu mendeklarasikan ulang setiap kali membuat broadcast.

#### Acceptance Criteria

1. WHEN Channel_Default settings include Altered_Content declaration THEN the YouTube_Sync_System SHALL pre-select the Altered_Content checkbox based on channel default
2. WHEN the user changes the Altered_Content selection THEN the YouTube_Sync_System SHALL use the user-selected value for broadcast creation

### Requirement 4

**User Story:** Sebagai pengguna, saya ingin tags terisi otomatis dari default YouTube, sehingga video saya memiliki tags yang konsisten.

#### Acceptance Criteria

1. WHEN Channel_Default settings include Tags THEN the YouTube_Sync_System SHALL populate the tags field with default tags
2. WHEN the user adds or removes Tags THEN the YouTube_Sync_System SHALL use the user-modified tags for broadcast creation
3. WHEN displaying Tags THEN the YouTube_Sync_System SHALL show each tag as a removable chip element

### Requirement 5

**User Story:** Sebagai pengguna, saya ingin melihat indikator bahwa data diambil dari YouTube default, sehingga saya tahu field mana yang terisi otomatis.

#### Acceptance Criteria

1. WHEN fields are auto-populated from Channel_Default THEN the YouTube_Sync_System SHALL display a visual indicator showing the data source
2. WHEN the user hovers over the indicator THEN the YouTube_Sync_System SHALL display a tooltip explaining the auto-fill feature
3. WHEN auto-population is in progress THEN the YouTube_Sync_System SHALL display a loading indicator on affected fields
