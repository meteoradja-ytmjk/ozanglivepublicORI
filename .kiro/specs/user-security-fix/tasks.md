# Implementation Plan

- [x] 1. Fix UI escaping untuk menampilkan dan menghapus user dengan username berbahaya




  - [ ] 1.1 Update views/users.ejs untuk menggunakan data attributes
    - Ganti inline onclick dengan data-user-id dan data-username attributes
    - Escape username menggunakan EJS escape syntax `<%=`

    - Update JavaScript untuk membaca dari data attributes
    - _Requirements: 1.1, 1.3, 3.1, 3.3_
  - [x] 1.2 Update fungsi deleteUser di JavaScript

    - Baca user ID dan username dari data attributes
    - Pastikan konfirmasi modal menampilkan username dengan aman
    - _Requirements: 1.1, 4.2_




  - [ ] 1.3 Update fungsi editUser di JavaScript
    - Baca semua data dari data attributes


    - Escape data sebelum digunakan di form


    - _Requirements: 3.1, 3.3_





- [x] 2. Tambahkan validasi username saat registrasi




  - [ ] 2.1 Update validasi di app.js untuk signup route
    - Tambahkan regex validation untuk username



    - Hanya izinkan huruf, angka, dan underscore
    - _Requirements: 2.1, 2.2, 2.3_


  - [x] 2.2 Update validasi di app.js untuk setup-account route



    - Terapkan validasi yang sama dengan signup
    - _Requirements: 2.1, 2.2_
  - [ ] 2.3 Update validasi di app.js untuk user create API
    - Validasi username sebelum menyimpan ke database
    - _Requirements: 2.1, 2.2_
  - [ ] 2.4 Write property test untuk username validation
    - **Property 2: Username Validation Correctness**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 3. Checkpoint - Pastikan semua perubahan berfungsi
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Hapus user berbahaya yang sudah ada
  - [ ] 4.1 Identifikasi dan hapus user dengan username mencurigakan
    - Hapus user `'="or'` dari database
    - Verifikasi penghapusan berhasil
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Write property tests untuk escape function
  - [ ] 5.1 Write property test untuk HTML escaping
    - **Property 1: Username Escape Safety**
    - **Validates: Requirements 1.1, 1.3, 3.1**
  - [ ] 5.2 Write property test untuk delete operation
    - **Property 3: Delete Operation Independence**
    - **Validates: Requirements 1.2, 4.2**

- [ ] 6. Final Checkpoint - Pastikan semua tests passing
  - Ensure all tests pass, ask the user if questions arise.
