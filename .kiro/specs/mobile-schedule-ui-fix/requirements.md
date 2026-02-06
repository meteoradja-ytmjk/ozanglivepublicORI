# Requirements Document

## Introduction

Fitur ini mencakup dua perbaikan utama:
1. Memperbaiki tampilan form scheduling pada Stream Modal di tampilan mobile - menyembunyikan field "Start Stream" dan "End Stream" saat Daily/Weekly dipilih
2. Memperbaiki sinkronisasi status stream antara aplikasi dan YouTube - memastikan stream berhenti sesuai dengan durasi/end time yang dijadwalkan

## Glossary

- **Stream Modal**: Dialog/popup untuk membuat atau mengedit stream baru
- **Schedule Type**: Tipe jadwal streaming (Once, Daily, Weekly)
- **Start Stream**: Field input datetime untuk waktu mulai stream (hanya untuk schedule type "Once")
- **End Stream**: Field input datetime untuk waktu akhir stream (hanya untuk schedule type "Once")
- **Recurring Schedule Settings**: Pengaturan jadwal berulang yang muncul untuk Daily/Weekly
- **Once Schedule Settings**: Pengaturan jadwal sekali yang berisi Start Stream dan End Stream
- **Stream Duration**: Durasi streaming dalam jam yang ditentukan pengguna
- **FFmpeg Process**: Proses yang menjalankan streaming ke platform (YouTube, dll)

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna mobile, saya ingin melihat form scheduling yang konsisten dengan tampilan desktop, sehingga saya tidak bingung dengan field yang tidak relevan.

#### Acceptance Criteria

1. WHEN pengguna memilih schedule type "Daily" pada tampilan mobile THEN Stream Modal SHALL menyembunyikan field Start Stream dan End Stream
2. WHEN pengguna memilih schedule type "Weekly" pada tampilan mobile THEN Stream Modal SHALL menyembunyikan field Start Stream dan End Stream
3. WHEN pengguna memilih schedule type "Once" pada tampilan mobile THEN Stream Modal SHALL menampilkan field Start Stream dan End Stream
4. WHEN schedule type berubah dari "Daily" atau "Weekly" ke "Once" THEN Stream Modal SHALL menampilkan kembali field Start Stream dan End Stream

### Requirement 2

**User Story:** Sebagai pengguna mobile, saya ingin form scheduling yang bersih dan tidak membingungkan, sehingga saya dapat dengan mudah mengatur jadwal streaming.

#### Acceptance Criteria

1. WHEN pengguna memilih schedule type "Daily" THEN Stream Modal SHALL menampilkan hanya field Stream Time (Daily) dan Enable Recurring toggle
2. WHEN pengguna memilih schedule type "Weekly" THEN Stream Modal SHALL menampilkan field Stream Time, Day Selector, dan Enable Recurring toggle
3. WHEN tampilan mobile aktif THEN Stream Modal SHALL memiliki perilaku show/hide yang identik dengan tampilan desktop
4. WHEN schedule type "Daily" atau "Weekly" dipilih THEN Stream Modal SHALL menampilkan setiap label/teks hanya satu kali tanpa duplikasi
5. WHEN form scheduling ditampilkan THEN Stream Modal SHALL menghindari elemen UI yang redundan atau terduplikasi baik di desktop maupun mobile

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin stream berhenti secara otomatis sesuai dengan durasi atau end time yang saya jadwalkan, sehingga status di aplikasi dan YouTube tetap sinkron.

#### Acceptance Criteria

1. WHEN stream duration diatur THEN Streaming Service SHALL menghentikan FFmpeg process tepat setelah durasi tercapai
2. WHEN schedule end time diatur THEN Streaming Service SHALL menghentikan FFmpeg process tepat pada waktu end time
3. WHEN stream dihentikan secara otomatis THEN Streaming Service SHALL memperbarui status stream di database menjadi "stopped"
4. WHEN stream dihentikan secara otomatis THEN Dashboard SHALL menampilkan status stream yang akurat (tidak live lagi)
5. WHEN FFmpeg process berhenti karena error atau timeout THEN Streaming Service SHALL mendeteksi dan memperbarui status stream di database
