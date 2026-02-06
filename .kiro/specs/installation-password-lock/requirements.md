# Requirements Document

## Introduction

Fitur Installation Password Lock adalah mekanisme keamanan yang mengharuskan pengguna memasukkan password yang valid sebelum dapat melanjutkan proses instalasi aplikasi OzangLive di VPS. Fitur ini bertujuan untuk mencegah instalasi tidak sah dan melindungi distribusi aplikasi agar hanya pengguna yang memiliki akses password dari developer yang dapat menginstal dan menggunakan aplikasi. Password instalasi yang ditetapkan adalah `1988`.

## Glossary

- **Installation_Password_System**: Sistem validasi password yang berjalan selama proses instalasi untuk memverifikasi hak akses pengguna
- **Installation_Script**: Script bash (install.sh) yang menjalankan proses instalasi otomatis di VPS
- **Password_Prompt**: Antarmuka command-line yang meminta pengguna memasukkan password
- **Password_Hash**: Nilai hash dari password yang disimpan untuk validasi
- **Installation_Lock**: Mekanisme yang mencegah instalasi berlanjut tanpa password yang valid
- **Retry_Limit**: Batas maksimum percobaan memasukkan password yang salah

## Requirements

### Requirement 1

**User Story:** Sebagai pemilik aplikasi, saya ingin instalasi dikunci dengan password, sehingga hanya pengguna yang memiliki password yang dapat menginstal aplikasi di VPS mereka.

#### Acceptance Criteria

1. WHEN pengguna menjalankan script instalasi THEN Installation_Password_System SHALL menampilkan Password_Prompt sebelum proses instalasi dimulai
2. WHEN pengguna memasukkan password yang benar THEN Installation_Password_System SHALL melanjutkan proses instalasi secara normal
3. WHEN pengguna memasukkan password yang salah THEN Installation_Password_System SHALL menampilkan pesan error dan meminta input ulang
4. WHEN pengguna mencapai Retry_Limit (3 kali percobaan gagal) THEN Installation_Password_System SHALL menghentikan proses instalasi dan menampilkan pesan penolakan
5. WHILE Password_Prompt aktif THEN Installation_Password_System SHALL menyembunyikan karakter password yang diketik (tidak ditampilkan di terminal)

### Requirement 2

**User Story:** Sebagai pemilik aplikasi, saya ingin password instalasi disimpan dengan aman, sehingga password tidak dapat dengan mudah dibaca dari source code.

#### Acceptance Criteria

1. WHEN password disimpan dalam sistem THEN Installation_Password_System SHALL menggunakan hash SHA-256 untuk menyimpan password
2. WHEN validasi password dilakukan THEN Installation_Password_System SHALL membandingkan hash dari input dengan hash yang tersimpan
3. WHEN script instalasi di-clone dari repository THEN Installation_Password_System SHALL memuat password hash dari variabel yang sudah di-encode

### Requirement 3

**User Story:** Sebagai pengguna yang sah, saya ingin mendapatkan feedback yang jelas selama proses validasi password, sehingga saya tahu status instalasi.

#### Acceptance Criteria

1. WHEN Password_Prompt ditampilkan THEN Installation_Password_System SHALL menampilkan instruksi yang jelas untuk memasukkan password
2. WHEN password berhasil divalidasi THEN Installation_Password_System SHALL menampilkan pesan konfirmasi sukses sebelum melanjutkan instalasi
3. WHEN password gagal divalidasi THEN Installation_Password_System SHALL menampilkan jumlah percobaan tersisa
4. WHEN instalasi dibatalkan karena password salah THEN Installation_Password_System SHALL menampilkan pesan yang menjelaskan alasan pembatalan dan cara mendapatkan password yang valid

### Requirement 4

**User Story:** Sebagai developer aplikasi, saya ingin password instalasi sudah ditetapkan secara permanen, sehingga semua pengguna yang ingin menginstal harus menghubungi saya untuk mendapatkan password.

#### Acceptance Criteria

1. WHEN script instalasi dibuat THEN Installation_Password_System SHALL menggunakan password tetap yang sudah di-hardcode dalam bentuk hash
2. WHEN pengguna tidak mengetahui password atau gagal validasi THEN Installation_Password_System SHALL menampilkan informasi kontak developer via WhatsApp 089621453431
3. WHEN validasi dilakukan THEN Installation_Password_System SHALL membandingkan input dengan password yang sudah ditetapkan (1988)
