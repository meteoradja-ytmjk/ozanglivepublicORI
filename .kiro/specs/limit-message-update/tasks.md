# Implementation Plan

- [x] 1. Update pesan limit di backend service
  - [x] 1.1 Update pesan di LiveLimitService
    - Ubah pesan dari "Batas live streaming tercapai. Hubungi Admin untuk menambah limit." menjadi "Hubungi Admin Untuk Menambah Limit"
    - File: `services/liveLimitService.js`
    - _Requirements: 1.1, 2.2_
  - [x] 1.2 Write property test untuk konsistensi pesan
    - **Property 1: Limit message consistency**
    - **Validates: Requirements 1.1, 2.2**

- [x] 2. Implementasi center toast component
  - [x] 2.1 Tambahkan HTML element untuk center toast
    - Tambahkan div dengan id `center-toast` di `views/dashboard.ejs`
    - Posisi fixed di tengah layar
    - _Requirements: 1.2_
  - [x] 2.2 Tambahkan CSS styling untuk center toast
    - Styling untuk posisi center (transform translate)
    - Animasi fade-in dan fade-out
    - Warning/error color scheme
    - File: `public/css/styles.css`
    - _Requirements: 1.2, 1.4, 2.3_
  - [x] 2.3 Implementasi fungsi showCenterToast di JavaScript
    - Fungsi dengan parameter type, message, duration (default 3000ms)
    - Auto-hide setelah duration
    - File: `views/dashboard.ejs` (inline script)
    - _Requirements: 1.3, 2.1_
  - [x] 2.4 Write property test untuk durasi default
    - **Property 2: Toast duration consistency**
    - **Validates: Requirements 1.3**

- [x] 3. Integrasi dengan flow limit check
  - [x] 3.1 Update handler saat limit tercapai
    - Panggil showCenterToast saat API mengembalikan error limit
    - Gunakan type 'warning' dengan pesan dari response
    - _Requirements: 1.1, 2.1_

- [x] 4. Checkpoint - Pastikan semua tests passing

  - Ensure all tests pass, ask the user if questions arise.
