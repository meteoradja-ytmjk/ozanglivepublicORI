# Requirements Document

## Introduction

Dokumen ini menjelaskan perbaikan UX pada sistem login dan registrasi StreamFlow. Fitur ini mencakup penghapusan field konfirmasi password untuk efisiensi, serta penambahan indikator visual yang membedakan login sebagai admin dan user biasa.

## Glossary

- **StreamFlow**: Aplikasi streaming video yang sedang dikembangkan
- **Admin**: Pengguna dengan hak akses penuh untuk mengelola sistem dan user lain
- **Member/User**: Pengguna biasa dengan akses terbatas pada fitur streaming
- **Setup Account**: Halaman untuk membuat akun admin pertama kali
- **Signup**: Halaman untuk registrasi user baru
- **Role Indicator**: Elemen visual yang menunjukkan peran pengguna (admin/member)

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna baru, saya ingin proses registrasi yang lebih cepat, sehingga saya dapat segera menggunakan aplikasi tanpa langkah yang berlebihan.

#### Acceptance Criteria

1. WHEN a user accesses the setup-account page THEN the StreamFlow system SHALL display only username and password fields without confirm password field
2. WHEN a user accesses the signup page THEN the StreamFlow system SHALL display only username and password fields without confirm password field
3. WHEN a user submits the registration form THEN the StreamFlow system SHALL validate password strength without requiring confirmation input
4. WHEN the password field loses focus THEN the StreamFlow system SHALL display password strength indicator to help user verify their input

### Requirement 2

**User Story:** Sebagai pengguna yang sudah login, saya ingin melihat indikator peran saya dengan jelas, sehingga saya tahu hak akses yang saya miliki.

#### Acceptance Criteria

1. WHEN an admin user logs in successfully THEN the StreamFlow system SHALL display an admin badge or indicator in the navigation area
2. WHEN a member user logs in successfully THEN the StreamFlow system SHALL display a member badge or indicator in the navigation area
3. WHEN displaying the role indicator THEN the StreamFlow system SHALL use distinct visual styling (color, icon, or label) to differentiate admin from member
4. WHEN the user views any authenticated page THEN the StreamFlow system SHALL consistently show the role indicator in the same location

### Requirement 3

**User Story:** Sebagai admin, saya ingin melihat perbedaan visual yang jelas antara akun admin dan member, sehingga saya dapat dengan mudah mengidentifikasi tipe akun.

#### Acceptance Criteria

1. WHEN displaying user information in the header/sidebar THEN the StreamFlow system SHALL show a role badge next to the username
2. WHEN the role is admin THEN the StreamFlow system SHALL display the badge with a distinct color (e.g., blue or gold) and admin icon
3. WHEN the role is member THEN the StreamFlow system SHALL display the badge with a different color (e.g., gray or green) and member icon
4. WHEN hovering over the role badge THEN the StreamFlow system SHALL display a tooltip explaining the role privileges
