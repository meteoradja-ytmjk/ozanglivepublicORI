# Implementation Plan

- [x] 1. Update Streaming Service untuk Video + Audio Merge
  - [x] 1.1 Modifikasi buildFFmpegArgs untuk mendukung audio terpisah
    - Import Audio model di streamingService.js
    - Tambah logic untuk mendapatkan audio path dari audio_id
    - Validasi file audio exists sebelum streaming
    - _Requirements: 1.1, 1.4_
  - [x] 1.2 Implementasi FFmpeg args dengan audio
    - Tambah `-stream_loop -1` untuk video input
    - Tambah `-stream_loop -1` untuk audio input
    - Tambah `-map 0:v:0 -map 1:a:0` untuk mapping
    - Tambah `-t` parameter untuk durasi
    - _Requirements: 1.1, 1.3, 2.1, 2.2_
  - [x] 1.3 Implementasi FFmpeg args tanpa audio (video only)
    - Pertahankan audio asli dari video
    - Tambah `-t` parameter untuk durasi
    - _Requirements: 1.2, 2.1_
  - [x] 1.4 Write property test untuk FFmpeg args dengan audio
    - **Property 1: FFmpeg args with audio contains correct mapping**
    - **Validates: Requirements 1.1, 1.3**
  - [x] 1.5 Write property test untuk FFmpeg args tanpa audio
    - **Property 2: FFmpeg args without audio uses video's original audio**
    - **Validates: Requirements 1.2**
  - [x] 1.6 Write property test untuk duration parameter
    - **Property 3: Duration parameter limits stream length**
    - **Validates: Requirements 2.1**
  - [x] 1.7 Write property test untuk audio looping
    - **Property 4: Audio looping enabled when audio selected**
    - **Validates: Requirements 2.2**

- [x] 2. Checkpoint - Pastikan streaming service berfungsi
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update UI Tabel Streaming Status
  - [x] 3.1 Tambah kolom nomor urut (No.)
    - Tambah header "No." di posisi pertama
    - Render nomor urut di setiap row
    - _Requirements: 4.1_
  - [x] 3.2 Update warna icon aksi
    - Play button: text-green-500 dengan bg-green-500/10
    - Stop button: text-red-500 dengan bg-red-500/10
    - Edit button: text-blue-500 dengan bg-blue-500/10
    - Delete button: text-red-500 dengan bg-red-500/10
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 3.3 Update format durasi
    - Tampilkan durasi dalam format "X jam"
    - Handle null duration dengan "-"
    - _Requirements: 4.2_
  - [x] 3.4 Update status badge
    - Live: bg-green-500
    - Scheduled: bg-yellow-500
    - Offline: bg-gray-500
    - _Requirements: 4.4_
  - [x] 3.5 Write property test untuk status badge color
    - **Property 5: Status badge color mapping**
    - **Validates: Requirements 4.4**
  - [x] 3.6 Write property test untuk duration format
    - **Property 6: Duration format correctness**
    - **Validates: Requirements 4.2**

- [x] 4. Update Layout Modal Create Stream
  - [x] 4.1 Hapus video preview section
    - Remove div dengan class "aspect-video" dan kontennya
    - Remove emptyPreview div
    - _Requirements: 5.1_
  - [x] 4.2 Update layout ke single column
    - Ubah grid dari 2 kolom ke 1 kolom
    - Atur urutan field: Video, Audio, Title, Stream Key, Duration, Schedule
    - _Requirements: 5.2, 5.3_

- [x] 5. Hapus kolom yang tidak diperlukan dari tabel
  - [x] 5.1 Hapus kolom Start Date dari tabel
    - Remove header "Start Date"
    - Remove cell start date dari render
    - _Requirements: 4.1_

- [x] 6. Final Checkpoint - Pastikan semua fitur berfungsi

  - Ensure all tests pass, ask the user if questions arise.
