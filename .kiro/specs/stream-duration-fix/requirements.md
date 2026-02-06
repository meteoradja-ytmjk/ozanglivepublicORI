# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk memperbaiki masalah durasi streaming yang tidak berhenti sesuai waktu yang ditentukan user. Saat ini, ketika user menentukan durasi streaming (misalnya 5 jam), aplikasi tidak menghentikan stream secara otomatis setelah durasi tersebut tercapai. Masalah ini kritis karena dapat menyebabkan streaming berjalan tanpa batas waktu.

## Glossary

- **Stream**: Proses siaran video/audio ke platform RTMP
- **Duration**: Lama waktu streaming yang ditentukan user dalam jam (stream_duration_hours)
- **FFmpeg**: Tool untuk encoding dan streaming video
- **Scheduler Service**: Service yang mengelola penjadwalan start/stop stream
- **Streaming Service**: Service yang mengelola proses FFmpeg untuk streaming
- **Termination Timer**: Timer yang dijadwalkan untuk menghentikan stream setelah durasi tertentu

## Requirements

### Requirement 1

**User Story:** Sebagai user, saya ingin stream berhenti otomatis setelah durasi yang saya tentukan, sehingga saya tidak perlu menghentikan stream secara manual.

#### Acceptance Criteria

1. WHEN user menentukan stream_duration_hours dan stream dimulai THEN Streaming Service SHALL menghitung waktu berakhir berdasarkan waktu mulai ditambah durasi dalam jam
2. WHEN waktu streaming mencapai durasi yang ditentukan THEN Scheduler Service SHALL menghentikan stream secara otomatis
3. WHEN stream dihentikan karena durasi tercapai THEN Streaming Service SHALL mencatat status stream sebagai 'offline' dan menyimpan end_time
4. WHEN FFmpeg process berhenti karena parameter -t (duration) THEN Streaming Service SHALL mendeteksi exit code normal dan tidak melakukan restart

### Requirement 2

**User Story:** Sebagai user, saya ingin sistem memiliki mekanisme backup untuk menghentikan stream, sehingga stream pasti berhenti meskipun ada kegagalan pada satu mekanisme.

#### Acceptance Criteria

1. WHEN stream dimulai dengan durasi THEN Streaming Service SHALL menerapkan dua mekanisme penghentian: FFmpeg -t parameter dan scheduler timer
2. WHEN FFmpeg -t parameter gagal menghentikan stream THEN Scheduler Service timer SHALL menghentikan stream sebagai backup
3. WHEN scheduler timer gagal THEN periodic duration check SHALL mendeteksi stream yang melewati durasi dan menghentikannya
4. WHEN stream dihentikan oleh mekanisme apapun THEN Streaming Service SHALL membersihkan semua timer dan resource terkait

### Requirement 3

**User Story:** Sebagai user, saya ingin melihat sisa waktu streaming, sehingga saya tahu kapan stream akan berakhir.

#### Acceptance Criteria

1. WHEN stream sedang live dengan durasi yang ditentukan THEN System SHALL menghitung dan menyediakan informasi sisa waktu streaming
2. WHEN sisa waktu streaming kurang dari 5 menit THEN System SHALL menyediakan informasi peringatan bahwa stream akan segera berakhir

### Requirement 4

**User Story:** Sebagai developer, saya ingin sistem logging yang jelas untuk durasi streaming, sehingga saya dapat men-debug masalah dengan mudah.

#### Acceptance Criteria

1. WHEN stream dimulai dengan durasi THEN System SHALL mencatat log dengan waktu mulai, durasi yang ditentukan, dan waktu berakhir yang diharapkan
2. WHEN termination timer dijadwalkan THEN System SHALL mencatat log dengan stream ID dan waktu yang dijadwalkan
3. WHEN stream dihentikan karena durasi THEN System SHALL mencatat log dengan alasan penghentian dan durasi aktual
