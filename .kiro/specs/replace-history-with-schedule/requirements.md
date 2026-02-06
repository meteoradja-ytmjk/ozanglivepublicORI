# Requirements Document

## Introduction

Fitur ini mengganti menu "History" yang kurang berguna dengan halaman "Schedule" yang menampilkan overview jadwal streaming. Halaman Schedule akan menampilkan semua stream yang terjadwal (once, daily, weekly) dalam format kalender/timeline yang mudah dipahami, membantu user mengelola jadwal streaming mereka dengan lebih efektif.

## Glossary

- **Schedule Page**: Halaman baru yang menampilkan overview jadwal streaming
- **Stream Schedule**: Jadwal streaming yang bisa berupa once (sekali), daily (harian), atau weekly (mingguan)
- **Sidebar**: Menu navigasi di sisi kiri (desktop) atau bottom navigation (mobile)
- **Upcoming Stream**: Stream yang dijadwalkan akan berjalan di masa depan
- **Active Stream**: Stream yang sedang berjalan (status live)

## Requirements

### Requirement 1

**User Story:** As a user, I want to see a Schedule menu instead of History, so that I can quickly access my streaming schedules.

#### Acceptance Criteria

1. WHEN the user views the sidebar navigation THEN the System SHALL display "Schedule" menu item with calendar icon instead of "History"
2. WHEN the user clicks the Schedule menu THEN the System SHALL navigate to the schedule page at `/schedule` route
3. WHEN the user is on the schedule page THEN the System SHALL highlight the Schedule menu as active

### Requirement 2

**User Story:** As a user, I want to see all my scheduled streams in one place, so that I can have an overview of my streaming schedule.

#### Acceptance Criteria

1. WHEN the schedule page loads THEN the System SHALL display a list of all scheduled streams grouped by schedule type (once, daily, weekly)
2. WHEN displaying scheduled streams THEN the System SHALL show stream title, platform, schedule time, and duration for each stream
3. WHEN a stream has recurring schedule (daily/weekly) THEN the System SHALL display the next scheduled run time
4. WHEN no scheduled streams exist THEN the System SHALL display an empty state with helpful message

### Requirement 3

**User Story:** As a user, I want to filter scheduled streams by type, so that I can focus on specific schedule categories.

#### Acceptance Criteria

1. WHEN the user views the schedule page THEN the System SHALL provide filter options for All, Once, Daily, and Weekly schedules
2. WHEN the user selects a filter THEN the System SHALL display only streams matching the selected schedule type
3. WHEN the filter changes THEN the System SHALL update the displayed list immediately without page reload

### Requirement 4

**User Story:** As a user, I want to see today's streaming schedule prominently, so that I can quickly know what streams are planned for today.

#### Acceptance Criteria

1. WHEN the schedule page loads THEN the System SHALL display a "Today's Schedule" section at the top
2. WHEN streams are scheduled for today THEN the System SHALL list them in chronological order with time remaining until start
3. WHEN no streams are scheduled for today THEN the System SHALL display "No streams scheduled for today" message

### Requirement 5

**User Story:** As a user, I want to quickly navigate to edit a scheduled stream, so that I can modify the schedule if needed.

#### Acceptance Criteria

1. WHEN viewing a scheduled stream THEN the System SHALL provide an edit button that opens the stream edit modal
2. WHEN the user clicks edit THEN the System SHALL open the edit modal with the stream's current settings pre-filled
3. WHEN the user saves changes THEN the System SHALL update the schedule display immediately

### Requirement 6

**User Story:** As a user, I want the schedule page to be responsive, so that I can view my schedules on both desktop and mobile devices.

#### Acceptance Criteria

1. WHEN viewing on desktop THEN the System SHALL display schedules in a table/card layout with full details
2. WHEN viewing on mobile THEN the System SHALL display schedules in a compact card layout optimized for small screens
3. WHEN the screen size changes THEN the System SHALL adapt the layout responsively
