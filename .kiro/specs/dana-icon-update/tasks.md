# Implementation Plan

- [x] 1. Tambahkan logo DANA ke folder assets




  - [ ] 1.1 Buat file SVG logo DANA di `public/images/dana-logo.svg`
    - Logo DANA berwarna biru (#108ee9 atau warna resmi DANA)




    - Ukuran viewBox yang sesuai untuk scaling
    - _Requirements: 1.1, 1.3, 1.4_

- [ ] 2. Update Mobile Header
  - [x] 2.1 Modifikasi section mobile header di `views/layout.ejs`




    - Hapus divider `<div class="h-4 w-px ...">` antara WhatsApp dan DANA
    - Ganti icon kopi `<i class="ti ti-coffee">` dengan `<img src="/images/dana-logo.svg">`
    - Hapus teks `<span>Traktir Kopi</span>`
    - Atur ukuran logo DANA sekitar h-5 (20px)
    - Ubah gap container menjadi `gap-2` untuk jarak yang dekat


    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 3.3_


- [ ] 3. Update Desktop Header
  - [ ] 3.1 Modifikasi section desktop header di `views/layout.ejs`
    - Hapus divider `<div class="h-5 w-px ...">` antara WhatsApp dan DANA
    - Ganti icon kopi `<i class="ti ti-coffee">` dengan `<img src="/images/dana-logo.svg">`
    - Hapus teks `<span>Traktir Kopi</span>`
    - Atur ukuran logo DANA sekitar h-6 (24px)
    - Hapus margin `mr-1.5` dan `ml-1.5`, gunakan gap pada container
    - _Requirements: 1.1, 1.2, 1.4, 2.2, 2.3, 3.1, 3.3_

- [ ] 4. Verifikasi dan Testing
  - [ ] 4.1 Verifikasi tampilan di browser
    - Pastikan logo DANA muncul dengan benar di mobile dan desktop
    - Pastikan jarak antara WhatsApp dan DANA dekat
    - Pastikan link donasi berfungsi (buka di tab baru)
    - Pastikan hover effect bekerja di desktop
    - _Requirements: 1.1, 2.1, 2.2, 2.4, 3.1, 3.2_
