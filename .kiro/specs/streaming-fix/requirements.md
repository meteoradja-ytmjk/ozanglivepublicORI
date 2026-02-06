# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk memperbaiki fitur live streaming yang mencakup: penggabungan video dan audio untuk streaming, looping video/audio sesuai durasi yang ditentukan user, perbaikan tampilan UI pada tabel Streaming Status dengan warna icon yang jelas, informasi durasi, nomor urut, dan penghapusan video preview untuk layout yang lebih rapi.

## Glossary

- **Streaming Service**: Layanan backend yang mengelola proses FFmpeg untuk live streaming ke platform seperti YouTube
- **FFmpeg**: Tool command-line untuk memproses video dan audio yang digunakan untuk streaming
- **RTMP**: Real-Time Messaging Protocol, protokol untuk streaming video/audio ke platform live streaming
- **Looping**: Pengulangan video/audio secara terus-menerus hingga durasi yang ditentukan tercapai
- **Stream Duration**: Durasi total streaming dalam jam yang ditentukan oleh user
- **Streaming Status Table**: Tabel di dashboard yang menampilkan daftar stream dengan status, aksi, dan informasi lainnya

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin menggabungkan video dengan audio terpisah saat live streaming, sehingga saya dapat menggunakan background music atau audio pilihan saya bersama video.

#### Acceptance Criteria

1. WHEN pengguna memilih video dan audio pada modal Create Stream THEN Streaming Service SHALL menggabungkan video dan audio tersebut menggunakan FFmpeg dengan audio menggantikan audio asli video
2. WHEN pengguna hanya memilih video tanpa audio THEN Streaming Service SHALL melakukan streaming dengan audio asli dari video
3. WHEN proses streaming dimulai dengan video dan audio THEN Streaming Service SHALL menggunakan parameter FFmpeg `-i` untuk video dan `-i` untuk audio dengan `-map` yang tepat
4. WHEN audio dipilih untuk streaming THEN Streaming Service SHALL memvalidasi bahwa file audio ada sebelum memulai streaming

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin video dan audio melakukan looping sesuai durasi yang saya tentukan, sehingga streaming berjalan terus-menerus tanpa berhenti sebelum waktunya.

#### Acceptance Criteria

1. WHEN pengguna mengatur durasi streaming (dalam jam) THEN Streaming Service SHALL melakukan looping video hingga durasi tersebut tercapai
2. WHEN audio dipilih bersama video THEN Streaming Service SHALL melakukan looping audio secara independen hingga durasi streaming tercapai
3. WHEN durasi streaming tercapai THEN Streaming Service SHALL menghentikan streaming secara otomatis
4. WHEN video lebih pendek dari durasi streaming THEN Streaming Service SHALL mengulang video dari awal secara seamless
5. WHEN audio lebih pendek dari durasi streaming THEN Streaming Service SHALL mengulang audio dari awal secara seamless

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin melihat icon aksi (play/stop, edit, hapus) dengan warna yang jelas, sehingga saya dapat dengan mudah membedakan fungsi setiap tombol.

#### Acceptance Criteria

1. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan icon Play dengan warna hijau (green-500)
2. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan icon Stop dengan warna merah (red-500)
3. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan icon Edit dengan warna biru (blue-500)
4. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan icon Delete dengan warna merah (red-500)
5. WHEN user hover pada icon aksi THEN Dashboard SHALL menampilkan efek hover yang lebih terang

### Requirement 4

**User Story:** Sebagai pengguna, saya ingin melihat informasi streaming yang lebih lengkap dan terorganisir, sehingga saya dapat memantau status streaming dengan mudah.

#### Acceptance Criteria

1. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan kolom nomor urut (No.) di posisi pertama
2. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan informasi durasi streaming dalam format yang mudah dibaca (contoh: "2 jam")
3. WHEN stream sedang live THEN Dashboard SHALL menampilkan elapsed time sejak streaming dimulai
4. WHEN tabel Streaming Status ditampilkan THEN Dashboard SHALL menampilkan status dengan badge yang jelas (Live=hijau, Scheduled=kuning, Offline=abu-abu)

### Requirement 5

**User Story:** Sebagai pengguna, saya ingin layout modal Create Stream yang lebih rapi tanpa video preview, sehingga form lebih fokus dan mudah digunakan.

#### Acceptance Criteria

1. WHEN modal Create New Stream dibuka THEN Dashboard SHALL menampilkan form tanpa section video preview
2. WHEN modal Create New Stream dibuka THEN Dashboard SHALL menggunakan layout single column yang lebih compact
3. WHEN form ditampilkan THEN Dashboard SHALL menampilkan semua field input dalam urutan yang logis: Video, Audio, Title, Stream Key, Duration, Schedule
