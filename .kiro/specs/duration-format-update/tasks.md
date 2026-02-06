# Implementation Plan

- [x] 1. Update database schema untuk mendukung durasi dalam menit
  - [x] 1.1 Tambahkan kolom stream_duration_minutes di database.js
    - Tambahkan ALTER TABLE untuk kolom baru stream_duration_minutes INTEGER
    - Tambahkan migration query untuk konversi data existing dari stream_duration_hours ke stream_duration_minutes
    - _Requirements: 3.2, 3.3_
  - [x] 1.2 Write property test untuk backward compatibility conversion
    - **Property 6: Backward compatibility conversion**
    - **Validates: Requirements 3.1**

- [x] 2. Update backend API untuk handle durasi jam dan menit
  - [x] 2.1 Update POST /api/streams di app.js
    - Terima parameter streamDurationHours dan streamDurationMinutes
    - Hitung total menit: (hours × 60) + minutes
    - Simpan ke field stream_duration_minutes
    - _Requirements: 1.4_
  - [x] 2.2 Update PUT /api/streams/:id di app.js
    - Handle update durasi dengan format baru
    - Kalkulasi total menit dari hours dan minutes
    - _Requirements: 1.4_
  - [x] 2.3 Write property test untuk total minutes calculation
    - **Property 3: Total minutes calculation correctness**
    - **Validates: Requirements 1.4**

- [x] 3. Update frontend form untuk input jam dan menit
  - [x] 3.1 Update form create stream di dashboard.ejs
    - Ganti single input "Duration (Hours)" dengan dua input: "Jam" dan "Menit"
    - Set validasi min/max untuk jam (0-168) dan menit (0-59)
    - Update label dari "Duration (Hours)" menjadi "Durasi"
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Tambahkan JavaScript utility functions
    - Implementasi calculateTotalMinutes(hours, minutes)
    - Implementasi formatDuration(totalMinutes)
    - Implementasi parseDurationToFields(totalMinutes)
    - _Requirements: 1.4, 2.1, 2.4_
  - [x] 3.3 Write property test untuk validation range
    - **Property 1: Hours validation range**
    - **Property 2: Minutes validation range**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 3.4 Write property test untuk format correctness
    - **Property 4: Duration format correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [x] 3.5 Write property test untuk round-trip consistency
    - **Property 5: Duration round-trip consistency**
    - **Validates: Requirements 2.4**

- [x] 4. Update display durasi di tabel stream
  - [x] 4.1 Update renderStreams function di dashboard.ejs
    - Gunakan formatDuration untuk menampilkan durasi dalam format "X jam Y menit"
    - Handle edge cases: hanya jam, hanya menit, atau keduanya
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.2 Update inline edit untuk durasi
    - Ubah inline edit dari single input menjadi dua input (jam dan menit)
    - Update saveDurationInlineEdit untuk handle format baru
    - _Requirements: 2.4_

- [x] 5. Update edit stream modal
  - [x] 5.1 Update editStream function
    - Parse stream_duration_minutes ke hours dan minutes
    - Isi kedua field dengan nilai yang benar saat edit modal dibuka
    - _Requirements: 2.4_
  - [x] 5.2 Update form submission handler
    - Kumpulkan nilai dari kedua field (jam dan menit)
    - Kirim ke API dengan parameter yang benar
    - _Requirements: 1.4_

- [x] 6. Checkpoint - Pastikan semua tests passing
  - All 23 tests passed successfully!
