# Requirements Document

## Introduction

Fitur ini menambahkan kemampuan untuk memilih audio terpisah pada modal "Create New Stream", menambahkan opsi durasi streaming dalam format jam, dan menghapus fitur Advanced Settings yang tidak diperlukan. Pengguna dapat melakukan live streaming dengan kombinasi video + audio, atau video saja tanpa audio, dengan durasi yang dapat dikonfigurasi.

## Glossary

- **Stream Modal**: Dialog modal untuk membuat stream baru yang berisi konfigurasi video, audio, RTMP, dan pengaturan jadwal
- **Audio Selector**: Komponen dropdown untuk memilih file audio yang akan digunakan bersama video saat streaming
- **Duration Selector**: Komponen dropdown untuk memilih durasi streaming dalam format jam (1 jam, 2 jam, dst)
- **Advanced Settings**: Fitur pengaturan lanjutan yang akan dihapus karena tidak diperlukan

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin memilih audio terpisah untuk streaming, sehingga saya dapat menggabungkan video dengan audio pilihan saya.

#### Acceptance Criteria

1. WHEN pengguna membuka modal Create New Stream THEN Stream Modal SHALL menampilkan dropdown Select Audio di bawah dropdown Select Video
2. WHEN pengguna mengklik dropdown Select Audio THEN Stream Modal SHALL menampilkan daftar file audio yang tersedia dari galeri
3. WHEN pengguna memilih audio dari dropdown THEN Stream Modal SHALL menampilkan nama audio yang dipilih pada dropdown
4. WHEN pengguna tidak memilih audio (opsional) THEN Stream Modal SHALL mengizinkan streaming dengan video saja tanpa audio tambahan
5. WHEN pengguna mencari audio di dropdown THEN Stream Modal SHALL memfilter daftar audio berdasarkan kata kunci pencarian

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin mengatur durasi streaming dalam format jam, sehingga saya dapat mengontrol berapa lama streaming akan berjalan secara efisien.

#### Acceptance Criteria

1. WHEN pengguna membuka modal Create New Stream THEN Stream Modal SHALL menampilkan dropdown Duration di area Schedule Settings
2. WHEN pengguna mengklik dropdown Duration THEN Stream Modal SHALL menampilkan opsi durasi: 1 jam, 2 jam, 3 jam, 4 jam, 5 jam, 6 jam, 8 jam, 12 jam, 24 jam, dan Custom
3. WHEN pengguna memilih durasi dari dropdown THEN Stream Modal SHALL menyimpan nilai durasi yang dipilih
4. WHEN pengguna memilih opsi Custom THEN Stream Modal SHALL mengizinkan input durasi manual dalam jam
5. WHEN durasi dipilih dan Start Stream diatur THEN Stream Modal SHALL menghitung End Stream secara otomatis berdasarkan durasi

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin antarmuka yang lebih sederhana tanpa Advanced Settings, sehingga proses pembuatan stream menjadi lebih mudah dan cepat.

#### Acceptance Criteria

1. WHEN pengguna membuka modal Create New Stream THEN Stream Modal SHALL tidak menampilkan bagian Advanced Settings
2. WHEN modal ditampilkan THEN Stream Modal SHALL mempertahankan semua fungsi inti (Select Video, Stream Title, RTMP URL, Stream Key, Schedule Settings)
3. WHEN Advanced Settings dihapus THEN Stream Modal SHALL tidak mempengaruhi fungsionalitas streaming yang ada

### Requirement 4

**User Story:** Sebagai pengguna, saya ingin Stream Configuration yang lebih rapi dengan default YouTube, sehingga saya dapat memulai streaming dengan cepat.

#### Acceptance Criteria

1. WHEN pengguna membuka modal Create New Stream THEN Stream Modal SHALL menampilkan RTMP URL dengan default value YouTube (rtmp://a.rtmp.youtube.com/live2)
2. WHEN modal ditampilkan THEN Stream Modal SHALL menampilkan RTMP URL dan Stream Key dalam satu baris yang rapi
3. WHEN pengguna ingin mengubah platform THEN Stream Modal SHALL mengizinkan pengguna mengedit RTMP URL secara manual
