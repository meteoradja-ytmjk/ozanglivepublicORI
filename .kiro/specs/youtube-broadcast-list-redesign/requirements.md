# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk merapikan tampilan daftar "Scheduled Broadcasts" di halaman YouTube Sync. Tampilan saat ini terlalu besar dengan card yang memakan banyak ruang. Perubahan ini bertujuan untuk membuat tampilan lebih compact/ramping dalam format list sederhana, dengan 3 tombol action yang lebih kecil, serta layout 2 grid untuk tombol Template dan tombol + (Create New) agar lebih terlihat jelas.

## Glossary

- **Broadcast_List**: Komponen UI yang menampilkan daftar scheduled broadcasts di halaman YouTube Sync
- **Stream_Key**: Kunci unik yang digunakan untuk streaming ke YouTube
- **Broadcast_Item**: Satu baris item dalam daftar broadcast yang berisi informasi broadcast
- **Action_Buttons**: Tombol-tombol aksi (edit, sync, delete) untuk setiap broadcast item dalam ukuran compact
- **Header_Buttons**: Tombol Template dan tombol + (Create New) di bagian atas list
- **Compact_List**: Format tampilan list yang ramping dengan informasi minimal per baris

## Requirements

### Requirement 1

**User Story:** As a user, I want to see Template and Create New buttons in a 2-column grid layout, so that both buttons are clearly visible and easy to access.

#### Acceptance Criteria

1. WHEN the Broadcast_List header is rendered THEN the system SHALL display the Template button and Create New (+) button in a 2-column grid layout
2. WHEN the Header_Buttons are rendered THEN the system SHALL give equal width to both buttons (50% each)
3. WHEN the Header_Buttons are rendered THEN the system SHALL display clear icons and labels for both buttons

### Requirement 2

**User Story:** As a user, I want to see a simple compact list of broadcasts, so that I can view many broadcasts at once without excessive scrolling.

#### Acceptance Criteria

1. WHEN the Broadcast_List is rendered THEN the system SHALL display each Broadcast_Item in a compact single-line row format
2. WHEN the Broadcast_List is rendered THEN the system SHALL display only essential information: number, title, privacy status, and stream key
3. WHEN the Broadcast_List is rendered THEN the system SHALL NOT display large cards, thumbnails, or excessive spacing between items
4. WHEN the Broadcast_List contains many items THEN the system SHALL allow efficient vertical scrolling through the compact list

### Requirement 3

**User Story:** As a user, I want compact action buttons for each broadcast, so that I can manage broadcasts without the buttons taking too much space.

#### Acceptance Criteria

1. WHEN a Broadcast_Item is rendered THEN the system SHALL display 3 compact Action_Buttons: edit, sync, and delete
2. WHEN the Action_Buttons are rendered THEN the system SHALL use small icon-only buttons without large backgrounds
3. WHEN the Action_Buttons are rendered THEN the system SHALL align buttons horizontally in a compact row at the end of each list item
4. WHEN the user clicks an Action_Button THEN the system SHALL provide visual feedback and execute the corresponding action

### Requirement 4

**User Story:** As a user, I want to see the stream key in the list, so that I can quickly identify and copy it.

#### Acceptance Criteria

1. WHEN a Broadcast_Item is rendered THEN the system SHALL display the stream key in a truncated format within the list row
2. WHEN a Broadcast_Item has no stream key THEN the system SHALL display a dash or placeholder text
3. WHEN the user clicks on the stream key area THEN the system SHALL copy the stream key to clipboard

### Requirement 5

**User Story:** As a mobile user, I want a responsive compact list layout, so that I can easily view and manage broadcasts on smaller screens.

#### Acceptance Criteria

1. WHEN the Broadcast_List is viewed on mobile devices THEN the system SHALL maintain the compact list format with stacked information
2. WHEN the mobile layout is rendered THEN the system SHALL display the Header_Buttons in 2-column grid layout
3. WHEN the mobile layout is rendered THEN the system SHALL ensure Action_Buttons remain compact but touchable (minimum 36px touch target)
4. WHEN the mobile layout is rendered THEN the system SHALL stack broadcast info vertically while keeping action buttons in a horizontal row

