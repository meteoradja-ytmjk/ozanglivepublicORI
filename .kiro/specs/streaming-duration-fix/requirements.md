# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk memperbaiki masalah livestreaming yang berhenti mendadak tidak sesuai dengan durasi yang telah ditentukan oleh user. Masalah utama yang teridentifikasi meliputi:

1. **Inkonsistensi field durasi**: Sistem menggunakan beberapa field berbeda (`stream_duration_hours`, `stream_duration_minutes`, `duration`) yang menyebabkan kebingungan dalam kalkulasi durasi
2. **Kalkulasi durasi FFmpeg tidak akurat**: Parameter `-t` pada FFmpeg tidak selalu dihitung dengan benar
3. **Duration tracking tidak sinkron**: `streamDurationInfo` Map tidak selalu sinkron dengan durasi sebenarnya
4. **Scheduler termination timing**: Scheduler mungkin menghentikan stream sebelum durasi tercapai karena kalkulasi yang salah

## Glossary

- **Stream**: Proses livestreaming video ke platform RTMP
- **FFmpeg**: Software untuk encoding dan streaming video
- **Duration**: Lama waktu streaming yang diinginkan user (dalam menit atau jam)
- **stream_duration_minutes**: Field database untuk menyimpan durasi streaming dalam menit
- **stream_duration_hours**: Field database lama (deprecated) untuk durasi dalam jam
- **Scheduler**: Service yang mengelola jadwal start/stop streaming
- **Duration Tracking**: Mekanisme untuk melacak kapan stream harus berakhir

## Requirements

### Requirement 1

**User Story:** Sebagai user, saya ingin streaming berjalan sesuai durasi yang saya tentukan, sehingga streaming tidak berhenti mendadak sebelum waktunya.

#### Acceptance Criteria

1. WHEN user menetapkan durasi streaming THEN Streaming_Service SHALL menggunakan `stream_duration_minutes` sebagai sumber utama durasi
2. WHEN streaming dimulai THEN Streaming_Service SHALL menghitung durasi dalam detik dengan rumus `stream_duration_minutes * 60`
3. WHEN durasi dihitung THEN Streaming_Service SHALL meneruskan nilai durasi ke parameter FFmpeg `-t` dengan benar
4. WHEN streaming berjalan THEN Streaming_Service SHALL memastikan stream berhenti tepat pada waktu yang ditentukan dengan toleransi maksimal 30 detik

### Requirement 2

**User Story:** Sebagai user, saya ingin sistem menggunakan satu field durasi yang konsisten, sehingga tidak ada kebingungan dalam kalkulasi durasi.

#### Acceptance Criteria

1. WHEN durasi streaming dihitung THEN Streaming_Service SHALL memprioritaskan `stream_duration_minutes` di atas field lainnya
2. WHEN `stream_duration_minutes` tidak tersedia THEN Streaming_Service SHALL fallback ke kalkulasi dari `end_time - schedule_time`
3. WHEN field durasi deprecated (`stream_duration_hours`) digunakan THEN Streaming_Service SHALL mengkonversi ke menit dengan rumus `hours * 60`
4. WHEN durasi dihitung dari schedule THEN Streaming_Service SHALL menggunakan durasi yang direncanakan bukan waktu absolut

### Requirement 3

**User Story:** Sebagai user, saya ingin duration tracking yang akurat, sehingga sistem tahu kapan harus menghentikan streaming.

#### Acceptance Criteria

1. WHEN streaming dimulai THEN Streaming_Service SHALL menyimpan `startTime`, `durationMs`, dan `expectedEndTime` ke duration tracking
2. WHEN duration tracking diset THEN Streaming_Service SHALL memastikan `expectedEndTime = startTime + durationMs`
3. WHEN streaming restart karena error THEN Streaming_Service SHALL menghitung ulang remaining duration berdasarkan waktu yang sudah berjalan
4. WHEN scheduler memeriksa durasi THEN Streaming_Service SHALL membandingkan waktu sekarang dengan `expectedEndTime` yang tersimpan

### Requirement 4

**User Story:** Sebagai user, saya ingin scheduler termination yang reliable, sehingga streaming berhenti tepat waktu meskipun FFmpeg gagal.

#### Acceptance Criteria

1. WHEN streaming dimulai THEN Scheduler_Service SHALL menjadwalkan termination berdasarkan durasi yang dihitung
2. WHEN FFmpeg parameter `-t` gagal menghentikan stream THEN Scheduler_Service SHALL menghentikan stream secara paksa
3. WHEN stream melebihi durasi lebih dari 60 detik THEN Scheduler_Service SHALL melakukan force stop
4. WHEN scheduler memeriksa durasi THEN Scheduler_Service SHALL menggunakan `start_time` aktual bukan `schedule_time`

### Requirement 5

**User Story:** Sebagai user, saya ingin logging yang jelas tentang durasi streaming, sehingga saya bisa debug jika ada masalah.

#### Acceptance Criteria

1. WHEN durasi dihitung THEN Streaming_Service SHALL mencatat log dengan format "Duration set: X minutes (Y seconds)"
2. WHEN streaming dimulai THEN Streaming_Service SHALL mencatat log expected end time dalam format ISO
3. WHEN streaming berhenti THEN Streaming_Service SHALL mencatat log alasan berhenti (duration reached, manual stop, error)
4. WHEN ada perbedaan antara durasi yang diset dan durasi aktual THEN Streaming_Service SHALL mencatat log warning

