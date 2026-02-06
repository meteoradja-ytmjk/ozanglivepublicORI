# Requirements Document

## Introduction

Dokumen ini mendefinisikan requirements untuk memperbaiki input jam pada schedule di dashboard. Saat ini, input jam inline kurang responsif dan mudah hilang ketika user mencoba menginput waktu. Perbaikan ini bertujuan untuk meningkatkan UX input jam schedule agar lebih stabil dan mudah digunakan.

## Glossary

- **Schedule Cell**: Sel pada tabel stream yang menampilkan informasi jadwal streaming
- **Inline Edit**: Mode edit langsung pada cell tanpa membuka modal
- **Time Input**: Input field untuk memasukkan waktu dalam format HH:MM
- **Blur Event**: Event yang terjadi ketika input kehilangan fokus
- **Dashboard**: Halaman utama aplikasi yang menampilkan daftar stream

## Requirements

### Requirement 1

**User Story:** As a user, I want to edit schedule time inline without the input disappearing unexpectedly, so that I can quickly update stream schedules.

#### Acceptance Criteria

1. WHEN a user clicks on the schedule cell THEN the System SHALL display a time input field that remains visible until explicitly saved or cancelled
2. WHEN a user is typing in the time input THEN the System SHALL prevent the input from closing due to brief focus loss
3. WHEN a user presses Enter key THEN the System SHALL save the time value and close the input
4. WHEN a user presses Escape key THEN the System SHALL cancel the edit and restore the original value
5. WHEN a user clicks outside the input area THEN the System SHALL save the current value after a reasonable delay (300ms minimum)

### Requirement 2

**User Story:** As a user, I want the time input to be clearly visible and easy to interact with, so that I can accurately enter the desired time.

#### Acceptance Criteria

1. WHEN the inline time input is displayed THEN the System SHALL render the input with adequate width (minimum 100px) for comfortable interaction
2. WHEN the inline time input is active THEN the System SHALL display a clear visual indicator (border highlight) showing edit mode
3. WHEN the time input receives focus THEN the System SHALL select all existing content for easy replacement
4. WHEN the time input is displayed THEN the System SHALL position the input within the visible viewport

### Requirement 3

**User Story:** As a user, I want clear feedback when my schedule time is saved, so that I know the update was successful.

#### Acceptance Criteria

1. WHEN a schedule time is successfully saved THEN the System SHALL update the displayed schedule information immediately
2. WHEN a schedule time save fails THEN the System SHALL restore the original value and maintain the cell state
3. WHEN the save operation is in progress THEN the System SHALL prevent duplicate save attempts
