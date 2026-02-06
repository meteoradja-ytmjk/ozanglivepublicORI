# Requirements Document

## Introduction

Fitur ini mengubah fungsi tombol di samping stream key pada halaman YouTube Sync. Saat ini tombol tersebut berfungsi untuk menyalin stream key ke clipboard. Perubahan yang diinginkan adalah mengganti fungsi tombol tersebut menjadi shortcut untuk langsung menuju halaman edit stream (penjadwalan) di aplikasi berdasarkan stream key yang sama.

## Glossary

- **Stream Key**: Kode unik yang digunakan untuk mengidentifikasi stream, tersimpan di tabel streams sebagai `stream_key` dan di YouTube broadcast sebagai `streamKey`
- **YouTube Sync Page**: Halaman dalam aplikasi (`/youtube`) yang menampilkan daftar scheduled broadcasts YouTube
- **Stream Schedule Page**: Halaman dalam aplikasi (`/schedule`) yang menampilkan dan mengelola jadwal streaming
- **Edit Stream Modal**: Modal dialog di halaman Schedule yang digunakan untuk mengedit pengaturan stream/jadwal
- **Broadcast**: Siaran terjadwal yang dibuat di YouTube melalui aplikasi
- **Stream**: Entitas penjadwalan streaming di aplikasi yang memiliki stream_key untuk koneksi ke platform

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin dapat langsung menuju edit stream di halaman Schedule dengan mengklik tombol di samping stream key, sehingga saya dapat mengakses pengaturan jadwal streaming dengan lebih cepat.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol di samping stream key pada tampilan desktop THEN sistem SHALL mencari stream di database yang memiliki stream_key yang sama dan membuka halaman Schedule dengan modal edit stream terbuka
2. WHEN pengguna mengklik tombol di samping stream key pada tampilan mobile THEN sistem SHALL mencari stream di database yang memiliki stream_key yang sama dan membuka halaman Schedule dengan modal edit stream terbuka
3. WHEN stream dengan stream_key yang sama tidak ditemukan THEN sistem SHALL menampilkan pesan notifikasi bahwa stream tidak ditemukan di jadwal
4. WHEN tombol shortcut diklik THEN sistem SHALL menampilkan ikon edit (bukan ikon copy) pada tombol tersebut
5. WHEN pengguna mengarahkan kursor ke tombol THEN sistem SHALL menampilkan tooltip "Edit Stream Schedule" sebagai pengganti "Copy Stream Key"

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin tombol edit shortcut memiliki tampilan visual yang konsisten dengan tombol edit yang sudah ada, sehingga saya dapat dengan mudah mengenali fungsinya.

#### Acceptance Criteria

1. WHEN tombol edit shortcut ditampilkan THEN sistem SHALL menggunakan ikon `ti-edit` yang sama dengan tombol edit di kolom Actions
2. WHEN pengguna mengarahkan kursor ke tombol pada desktop THEN sistem SHALL menampilkan efek hover yang konsisten dengan tombol lainnya
3. WHEN tombol edit shortcut ditampilkan pada mobile THEN sistem SHALL mempertahankan ukuran minimum 44x44 pixel untuk aksesibilitas touch target
