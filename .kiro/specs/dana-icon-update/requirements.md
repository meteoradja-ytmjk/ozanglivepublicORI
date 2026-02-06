# Requirements Document

## Introduction

Fitur ini bertujuan untuk memperbarui tampilan icon donasi di pojok kanan header aplikasi StreamFlow. Perubahan meliputi penggantian icon kopi dan tulisan "Traktir Kopi" dengan logo aplikasi DANA, serta mengatur jarak antara icon WhatsApp dan DANA agar lebih dekat.

## Glossary

- **Header**: Area navigasi di bagian atas aplikasi yang menampilkan icon-icon aksi
- **Mobile Header**: Header yang ditampilkan pada tampilan mobile (layar < 1024px)
- **Desktop Header**: Header yang ditampilkan pada tampilan desktop (layar >= 1024px)
- **DANA**: Aplikasi dompet digital Indonesia yang digunakan untuk menerima donasi
- **Icon Donasi**: Elemen visual yang mengarahkan pengguna ke link donasi DANA

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin melihat logo DANA yang jelas di header, sehingga saya dapat dengan mudah mengenali opsi donasi melalui DANA.

#### Acceptance Criteria

1. WHEN pengguna melihat header aplikasi THEN sistem SHALL menampilkan logo DANA sebagai pengganti icon kopi
2. WHEN logo DANA ditampilkan THEN sistem SHALL menghilangkan tulisan "Traktir Kopi" yang sebelumnya ada
3. WHEN logo DANA ditampilkan di mobile header THEN sistem SHALL menggunakan ukuran yang proporsional dengan tinggi header (sekitar 20-24px)
4. WHEN logo DANA ditampilkan di desktop header THEN sistem SHALL menggunakan ukuran yang proporsional dengan tinggi header (sekitar 24-28px)

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin icon WhatsApp dan DANA ditampilkan berdekatan, sehingga tampilan header terlihat rapi dan kompak.

#### Acceptance Criteria

1. WHEN icon WhatsApp dan DANA ditampilkan di mobile header THEN sistem SHALL mengatur jarak antar icon dengan gap minimal (sekitar 4-8px)
2. WHEN icon WhatsApp dan DANA ditampilkan di desktop header THEN sistem SHALL mengatur jarak antar icon dengan gap minimal (sekitar 6-10px)
3. WHEN separator/divider antara icon ditampilkan THEN sistem SHALL menghilangkan divider tersebut untuk tampilan yang lebih bersih
4. WHEN icon-icon ditampilkan THEN sistem SHALL memastikan kedua icon tetap dapat diklik dengan mudah tanpa tumpang tindih

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin link donasi DANA tetap berfungsi dengan benar, sehingga saya dapat melakukan donasi dengan mudah.

#### Acceptance Criteria

1. WHEN pengguna mengklik logo DANA THEN sistem SHALL membuka link donasi DANA di tab baru
2. WHEN pengguna hover pada logo DANA di desktop THEN sistem SHALL menampilkan efek hover yang konsisten dengan icon WhatsApp
3. WHEN logo DANA ditampilkan THEN sistem SHALL menyertakan atribut title "Donate via Dana" untuk aksesibilitas
