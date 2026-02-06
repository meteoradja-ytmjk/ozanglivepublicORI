# Implementation Plan

## Task Overview

Perbaikan untuk memastikan livestreaming berhenti sesuai durasi yang diinput user, terutama untuk recurring streams (daily/weekly).

---

- [x] 1. Fix Duration Tracking in startStream




  - [ ] 1.1 Add duration tracking setup after stream starts
    - Set `streamDurationInfo` Map dengan `stream_duration_minutes` saat stream dimulai
    - Gunakan `stream_duration_minutes * 60 * 1000` untuk durasi dalam milliseconds


    - Log durasi yang diset untuk debugging




    - _Requirements: 1.1, 1.2_
  - [ ] 1.2 Write property test for duration tracking
    - **Property 3: End Time Calculation from Start Time**

    - **Validates: Requirements 1.3**




- [-] 2. Verify FFmpeg Duration Parameter

  - [ ] 2.1 Review and fix buildFFmpegArgs functions
    - Pastikan `stream_duration_minutes` digunakan sebagai prioritas utama

    - Pastikan `-t` parameter menerima nilai dalam detik yang benar
    - Tambahkan logging untuk nilai durasi yang digunakan


    - _Requirements: 1.1_




  - [ ] 2.2 Write property test for FFmpeg args
    - **Property 1: FFmpeg Duration Parameter Correctness**

    - **Validates: Requirements 1.1**




- [ ] 3. Fix Scheduler Duration Check
  - [ ] 3.1 Review and fix checkStreamDurations function
    - Pastikan menggunakan `start_time` (bukan `schedule_time`) untuk menghitung end time
    - Pastikan `stream_duration_minutes` digunakan sebagai prioritas utama
    - Tambahkan logging yang lebih detail untuk debugging
    - _Requirements: 1.3, 2.1_
  - [ ] 3.2 Write property test for scheduler overdue detection
    - **Property 4: Scheduler Overdue Detection**
    - **Validates: Requirements 2.1**

- [ ] 4. Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Verify Duration Calculator Priority
  - [ ] 5.1 Review calculateDurationSeconds function
    - Konfirmasi `stream_duration_minutes` adalah prioritas utama
    - Pastikan recurring streams tidak menggunakan stale schedule values
    - _Requirements: 1.2_
  - [ ] 5.2 Write property test for recurring stream duration priority
    - **Property 2: Recurring Stream Duration Priority**
    - **Validates: Requirements 1.2**

- [ ] 6. Final Checkpoint - Make sure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
