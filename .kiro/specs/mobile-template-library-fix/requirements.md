# Requirements Document

## Introduction

Perbaikan tampilan Template Library modal pada perangkat mobile. Saat ini tampilan template cards berantakan dengan tombol-tombol yang tidak tertata rapi, informasi terpotong, dan layout yang tidak responsif. Tujuannya adalah membuat tampilan lebih simple dan mudah digunakan di layar kecil.

## Glossary

- **Template Library Modal**: Modal popup yang menampilkan daftar broadcast templates yang tersimpan
- **Template Card**: Komponen UI yang menampilkan informasi satu template termasuk nama, title, channel, dan action buttons
- **Mobile View**: Tampilan pada layar dengan lebar kurang dari 768px (breakpoint md)
- **Action Buttons**: Tombol-tombol untuk operasi template seperti Re-create, Bulk, Edit, Delete, dan Toggle Recurring

## Requirements

### Requirement 1

**User Story:** As a mobile user, I want to see template cards in a clean vertical layout, so that I can easily read template information without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the Template Library modal opens on mobile THEN the system SHALL display template cards in a single-column vertical layout
2. WHEN displaying template information on mobile THEN the system SHALL show template name, title, and channel name in stacked format without truncation
3. WHEN the screen width is less than 768px THEN the system SHALL apply mobile-specific styling to template cards

### Requirement 2

**User Story:** As a mobile user, I want action buttons to be organized in a simple grid layout, so that I can easily tap the button I need.

#### Acceptance Criteria

1. WHEN displaying action buttons on mobile THEN the system SHALL arrange buttons in a 2-column or 3-column grid below the template info
2. WHEN a template has recurring enabled THEN the system SHALL show the recurring toggle button with clear On/Off state
3. WHEN displaying action buttons THEN the system SHALL use icon-only buttons with tooltips to save space on mobile

### Requirement 3

**User Story:** As a mobile user, I want the modal header to be compact and functional, so that I have more space to view templates.

#### Acceptance Criteria

1. WHEN the Template Library modal opens on mobile THEN the system SHALL display a compact header with title and close button
2. WHEN displaying the "New Template" button on mobile THEN the system SHALL show it as a compact button below the header description
3. WHEN the modal is displayed THEN the system SHALL ensure proper padding and spacing for touch targets (minimum 44px)

### Requirement 4

**User Story:** As a mobile user, I want recurring schedule information to be clearly visible, so that I can understand when broadcasts will be created automatically.

#### Acceptance Criteria

1. WHEN a template has recurring enabled THEN the system SHALL display the recurring pattern badge prominently
2. WHEN displaying next run time THEN the system SHALL show it in a readable format below the recurring pattern
3. WHEN the recurring info is displayed on mobile THEN the system SHALL use full-width layout for better readability
