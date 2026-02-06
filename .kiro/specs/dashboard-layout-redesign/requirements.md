# Requirements Document

## Introduction

Dokumen ini menjelaskan redesign layout dashboard StreamFlow untuk mengadopsi desain modern dengan tiga kolom: sidebar navigasi yang lebih lebar di kiri, area konten utama di tengah dengan statistik cards, dan panel analytics di kanan. Desain baru ini menggunakan tema dark dengan aksen warna cyan/teal untuk elemen interaktif.

## Glossary

- **StreamFlow**: Aplikasi streaming video yang sedang dikembangkan
- **Sidebar**: Panel navigasi vertikal di sisi kiri layar
- **Stats Card**: Komponen kartu yang menampilkan metrik statistik dengan icon dan nilai
- **Circular Progress**: Indikator progress berbentuk lingkaran dengan persentase
- **Analytics Panel**: Panel di sisi kanan yang menampilkan ringkasan data dan grafik
- **Dark Theme**: Skema warna gelap dengan background #1a1a2e atau serupa

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin sidebar navigasi yang lebih informatif dengan label teks, sehingga saya dapat dengan mudah memahami fungsi setiap menu.

#### Acceptance Criteria

1. WHEN the dashboard page loads THEN the StreamFlow system SHALL display a sidebar with width approximately 200-220px containing navigation items with both icons and text labels
2. WHEN a user views the sidebar THEN the StreamFlow system SHALL display the StreamFlow logo at the top of the sidebar
3. WHEN a user views the sidebar THEN the StreamFlow system SHALL display the following navigation menu items with icons:
   - Streams (ti-broadcast icon) - untuk Stream Manager
   - Gallery (ti-video icon) - untuk Video Gallery
   - Playlist (ti-playlist icon) - untuk Playlist Manager
   - History (ti-history icon) - untuk Stream History
   - Users (ti-users icon) - untuk User Management (hanya tampil untuk admin)
4. WHEN a user hovers over a navigation item THEN the StreamFlow system SHALL provide visual feedback with background color change
5. WHEN a navigation item is active THEN the StreamFlow system SHALL highlight it with a distinct background color (primary blue) or accent indicator

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin melihat profil saya di bagian bawah sidebar, sehingga saya dapat dengan mudah mengakses pengaturan akun.

#### Acceptance Criteria

1. WHEN the sidebar renders THEN the StreamFlow system SHALL display user avatar and username at the bottom section of the sidebar
2. WHEN a user clicks on the profile section THEN the StreamFlow system SHALL show a dropdown menu with profile options (Settings, Help, Sign Out)
3. WHEN displaying the profile section THEN the StreamFlow system SHALL show the user's role badge (Admin/Member) next to the username

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin melihat statistik sistem dalam bentuk cards yang menarik, sehingga saya dapat dengan cepat memahami status sistem.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the StreamFlow system SHALL display a row of stats cards showing StreamFlow metrics:
   - Active Streams - jumlah stream yang sedang aktif
   - CPU Usage - penggunaan CPU dalam persentase
   - Memory - penggunaan memori (used/total)
   - Internet Speed/Disk Usage - upload/download speed atau disk usage (toggle)
2. WHEN displaying stats cards THEN the StreamFlow system SHALL use dark card backgrounds (#252525 or similar) with rounded corners
3. WHEN displaying stats cards THEN the StreamFlow system SHALL show an icon, metric label, and value for each card
4. WHEN displaying CPU or Memory metrics THEN the StreamFlow system SHALL include a progress bar or circular progress indicator showing percentage

### Requirement 4

**User Story:** Sebagai pengguna, saya ingin melihat cards statistik tambahan dengan circular progress indicators, sehingga saya dapat memvisualisasikan data dengan lebih baik.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the StreamFlow system SHALL display secondary stats cards below the main stats row
2. WHEN displaying secondary stats cards THEN the StreamFlow system SHALL use circular progress indicators with percentage values
3. WHEN displaying secondary stats cards THEN the StreamFlow system SHALL use accent colors (cyan, purple, etc.) for the progress rings
4. WHEN a stats card has a highlighted state THEN the StreamFlow system SHALL display a colored border (e.g., cyan/teal border for emphasis)

### Requirement 5

**User Story:** Sebagai pengguna, saya ingin melihat panel analytics di sisi kanan, sehingga saya dapat melihat ringkasan data dan statistik tambahan.

#### Acceptance Criteria

1. WHEN the dashboard loads on desktop THEN the StreamFlow system SHALL display a right sidebar panel with streaming analytics summary
2. WHEN displaying the analytics panel THEN the StreamFlow system SHALL show StreamFlow-specific metrics:
   - Total Streams - jumlah total stream yang pernah dibuat
   - Total Videos - jumlah video di gallery
   - Active Users - jumlah user aktif (admin only)
   - Storage Used - penggunaan disk storage
3. WHEN displaying the analytics panel THEN the StreamFlow system SHALL include a statistics chart showing streaming activity (e.g., streams per day/week)
4. WHEN the viewport is mobile-sized THEN the StreamFlow system SHALL hide the right analytics panel and show data in the main content area

### Requirement 6

**User Story:** Sebagai pengguna, saya ingin header area dengan search bar dan action buttons, sehingga saya dapat mencari dan mengakses fitur dengan cepat.

#### Acceptance Criteria

1. WHEN the main content area renders THEN the StreamFlow system SHALL display a search input field at the top
2. WHEN the header area renders THEN the StreamFlow system SHALL display action buttons (settings, notifications, profile) in the top right corner
3. WHEN displaying the header THEN the StreamFlow system SHALL show a welcome message with the user's name
4. WHEN a filter button is present THEN the StreamFlow system SHALL allow users to filter displayed data

### Requirement 7

**User Story:** Sebagai pengguna, saya ingin layout yang responsif, sehingga saya dapat menggunakan aplikasi di berbagai ukuran layar.

#### Acceptance Criteria

1. WHEN the viewport width is less than 1024px THEN the StreamFlow system SHALL collapse the left sidebar to icon-only mode or hide it
2. WHEN the viewport width is less than 1024px THEN the StreamFlow system SHALL hide the right analytics panel
3. WHEN on mobile viewport THEN the StreamFlow system SHALL display a bottom navigation bar for primary navigation
4. WHEN transitioning between viewport sizes THEN the StreamFlow system SHALL animate layout changes smoothly

