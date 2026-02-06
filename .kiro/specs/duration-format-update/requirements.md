# Requirements Document

## Introduction

Fitur ini menambahkan opsi menit pada field durasi di form create/edit streaming. Saat ini field durasi hanya mendukung format jam (hours), user meminta untuk bisa memasukkan durasi dalam format jam dan menit agar lebih fleksibel dalam menentukan durasi streaming.

## Glossary

- **StreamFlow**: Sistem aplikasi streaming yang mengelola siaran video/audio ke platform RTMP
- **Duration**: Lama waktu streaming yang ditentukan user
- **Stream Modal**: Form popup untuk membuat atau mengedit konfigurasi stream
- **stream_duration_hours**: Field database yang menyimpan durasi streaming dalam jam (akan diubah menjadi menit untuk presisi lebih baik)

## Requirements

### Requirement 1

**User Story:** Sebagai user, saya ingin memasukkan durasi streaming dalam format jam dan menit, sehingga saya dapat menentukan durasi streaming dengan lebih presisi.

#### Acceptance Criteria

1. WHEN user membuka form create/edit stream THEN StreamFlow SHALL menampilkan dua field input terpisah untuk jam dan menit
2. WHEN user memasukkan nilai jam THEN StreamFlow SHALL menerima nilai integer dari 0 sampai 168
3. WHEN user memasukkan nilai menit THEN StreamFlow SHALL menerima nilai integer dari 0 sampai 59
4. WHEN user submit form dengan durasi THEN StreamFlow SHALL menghitung total durasi dalam menit dan menyimpan ke database
5. WHEN user tidak mengisi durasi (jam dan menit kosong) THEN StreamFlow SHALL menyimpan nilai null untuk durasi

### Requirement 2

**User Story:** Sebagai user, saya ingin melihat durasi yang sudah disimpan ditampilkan dalam format jam dan menit, sehingga saya dapat memahami durasi streaming dengan jelas.

#### Acceptance Criteria

1. WHEN stream memiliki durasi tersimpan THEN StreamFlow SHALL menampilkan durasi dalam format "X jam Y menit" di tabel stream
2. WHEN stream memiliki durasi hanya jam (menit = 0) THEN StreamFlow SHALL menampilkan format "X jam"
3. WHEN stream memiliki durasi hanya menit (jam = 0) THEN StreamFlow SHALL menampilkan format "Y menit"
4. WHEN user membuka edit modal untuk stream dengan durasi THEN StreamFlow SHALL mengisi field jam dan menit sesuai nilai tersimpan

### Requirement 3

**User Story:** Sebagai developer, saya ingin sistem tetap backward compatible dengan data durasi yang sudah ada, sehingga stream yang sudah dibuat sebelumnya tetap berfungsi dengan benar.

#### Acceptance Criteria

1. WHEN sistem membaca data stream lama dengan stream_duration_hours THEN StreamFlow SHALL mengkonversi nilai jam ke menit (hours × 60)
2. WHEN sistem menyimpan durasi baru THEN StreamFlow SHALL menyimpan dalam satuan menit ke field stream_duration_minutes
3. WHEN migrasi database dijalankan THEN StreamFlow SHALL menambahkan kolom stream_duration_minutes dan mengkonversi data existing
