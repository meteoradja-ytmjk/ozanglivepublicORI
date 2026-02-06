# Requirements Document

## Introduction

Fitur ini memungkinkan admin untuk mengontrol dan membatasi jumlah maksimal live streaming yang dapat dijalankan secara bersamaan oleh setiap member. Admin dapat mengatur batas default untuk semua member dan juga mengatur batas khusus per-user. Sistem akan memvalidasi batas ini sebelum member dapat memulai live streaming baru.

## Glossary

- **Admin**: Pengguna dengan role 'admin' yang memiliki akses penuh ke sistem termasuk manajemen user
- **Member**: Pengguna dengan role 'member' yang dapat membuat dan menjalankan live streaming
- **Live Limit**: Jumlah maksimal live streaming yang dapat berjalan bersamaan untuk satu user
- **Active Stream**: Stream dengan status 'live' yang sedang berjalan
- **System Settings**: Pengaturan global sistem yang berlaku untuk semua user
- **User Settings**: Pengaturan khusus per-user yang dapat override pengaturan sistem

## Requirements

### Requirement 1

**User Story:** Sebagai admin, saya ingin mengatur batas default jumlah live streaming untuk semua member, sehingga saya dapat mengontrol penggunaan resource sistem secara global.

#### Acceptance Criteria

1. WHEN admin mengakses halaman settings THEN System SHALL menampilkan input field untuk mengatur default live limit dengan nilai minimum 1
2. WHEN admin menyimpan nilai default live limit THEN System SHALL menyimpan nilai tersebut ke database dan menerapkannya untuk semua member yang tidak memiliki custom limit
3. WHEN nilai default live limit tidak diatur THEN System SHALL menggunakan nilai default yaitu 1 live streaming per member

### Requirement 2

**User Story:** Sebagai admin, saya ingin mengatur batas live streaming khusus untuk user tertentu, sehingga saya dapat memberikan fleksibilitas berdasarkan kebutuhan masing-masing member.

#### Acceptance Criteria

1. WHEN admin mengedit user di halaman user management THEN System SHALL menampilkan input field untuk mengatur custom live limit per-user
2. WHEN admin menyimpan custom live limit untuk user THEN System SHALL menyimpan nilai tersebut dan menggunakannya sebagai prioritas utama dibanding default limit
3. WHEN custom live limit user diset ke 0 atau dikosongkan THEN System SHALL menggunakan default live limit dari system settings
4. WHEN admin melihat daftar user THEN System SHALL menampilkan informasi live limit yang berlaku untuk setiap user

### Requirement 3

**User Story:** Sebagai sistem, saya ingin memvalidasi batas live streaming sebelum member memulai streaming baru, sehingga batas yang ditetapkan admin dapat ditegakkan.

#### Acceptance Criteria

1. WHEN member mencoba memulai live streaming baru THEN System SHALL menghitung jumlah active stream milik member tersebut
2. WHEN jumlah active stream sudah mencapai atau melebihi live limit THEN System SHALL menolak permintaan start streaming dan menampilkan pesan "Batas live streaming tercapai. Hubungi Admin untuk menambah limit."
3. WHEN jumlah active stream masih di bawah live limit THEN System SHALL mengizinkan member untuk memulai streaming baru
4. WHEN member dengan custom live limit mencoba memulai streaming THEN System SHALL menggunakan custom limit tersebut untuk validasi

### Requirement 4

**User Story:** Sebagai member, saya ingin melihat informasi tentang batas live streaming saya, sehingga saya dapat merencanakan penggunaan streaming dengan baik.

#### Acceptance Criteria

1. WHEN member mengakses dashboard THEN System SHALL menampilkan informasi jumlah active stream dan batas maksimal yang berlaku
2. WHEN member sudah mencapai batas live limit THEN System SHALL menampilkan indikator visual bahwa batas sudah tercapai
3. WHEN member mencoba memulai streaming melebihi batas THEN System SHALL menampilkan notifikasi "Batas live streaming tercapai. Hubungi Admin untuk menambah limit." beserta informasi jumlah streaming aktif saat ini
