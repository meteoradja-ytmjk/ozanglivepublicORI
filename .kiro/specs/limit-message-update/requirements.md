# Requirements Document

## Introduction

Fitur ini memperbarui tampilan pesan notifikasi ketika member mencapai batas live streaming. Pesan akan ditampilkan dengan teks baru "Hubungi Admin Untuk Menambah Limit", muncul di tengah layar sebagai toast/popup, dan otomatis menghilang setelah 2 detik.

## Glossary

- **Toast Notification**: Komponen UI berupa popup kecil yang menampilkan pesan sementara kepada pengguna
- **Live Limit**: Batas maksimal jumlah live streaming yang dapat berjalan bersamaan untuk satu user
- **Member**: Pengguna dengan role 'member' yang dapat membuat dan menjalankan live streaming
- **Center Toast**: Toast notification yang ditampilkan di posisi tengah layar (horizontal dan vertical center)

## Requirements

### Requirement 1

**User Story:** Sebagai member, saya ingin melihat pesan yang jelas dan mudah dibaca ketika mencapai batas live streaming, sehingga saya tahu harus menghubungi admin untuk menambah limit.

#### Acceptance Criteria

1. WHEN member mencoba memulai streaming melebihi batas THEN System SHALL menampilkan pesan "Hubungi Admin Untuk Menambah Limit"
2. WHEN pesan limit ditampilkan THEN System SHALL memposisikan toast notification di tengah layar secara horizontal dan vertical
3. WHEN pesan limit muncul THEN System SHALL menghilangkan pesan secara otomatis setelah 2 detik
4. WHEN pesan limit ditampilkan THEN System SHALL menggunakan styling yang kontras dan mudah dibaca (warning/error style)

### Requirement 2

**User Story:** Sebagai sistem, saya ingin memastikan pesan limit konsisten di semua tempat yang menampilkannya, sehingga pengalaman pengguna tetap seragam.

#### Acceptance Criteria

1. WHEN pesan limit ditampilkan dari dashboard THEN System SHALL menggunakan center toast dengan pesan yang sama
2. WHEN pesan limit ditampilkan dari API response THEN System SHALL mengembalikan pesan "Hubungi Admin Untuk Menambah Limit"
3. WHEN center toast ditampilkan THEN System SHALL memiliki animasi fade-in dan fade-out yang halus
