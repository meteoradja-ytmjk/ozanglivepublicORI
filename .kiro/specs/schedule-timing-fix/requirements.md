# Requirements Document

## Introduction

Fitur ini memperbaiki masalah sinkronisasi waktu pada scheduler streaming. Saat ini, streaming dimulai 2-4 menit lebih awal dari waktu yang dijadwalkan karena logika "early trigger" dan "lookahead" yang terlalu agresif. Perbaikan ini memastikan streaming dimulai tepat pada waktu yang dijadwalkan oleh pengguna.

## Glossary

- **Scheduler**: Komponen sistem yang memantau dan memicu streaming berdasarkan jadwal
- **Recurring Schedule**: Jadwal berulang (daily/weekly) yang diatur pengguna
- **One-time Schedule**: Jadwal sekali jalan pada waktu tertentu
- **WIB**: Waktu Indonesia Barat (Asia/Jakarta timezone, UTC+7)
- **Trigger Window**: Rentang waktu di mana scheduler akan memicu streaming
- **Lookahead**: Waktu ke depan yang diperiksa scheduler untuk jadwal one-time

## Requirements

### Requirement 1

**User Story:** Sebagai pengguna, saya ingin streaming dimulai tepat pada waktu yang saya jadwalkan, sehingga saya dapat merencanakan siaran dengan akurat.

#### Acceptance Criteria

1. WHEN waktu sistem mencapai waktu jadwal yang ditentukan THEN Scheduler SHALL memulai streaming dalam toleransi 1 menit setelah waktu jadwal
2. WHEN waktu sistem belum mencapai waktu jadwal THEN Scheduler SHALL menunggu hingga waktu jadwal tercapai sebelum memulai streaming
3. WHEN pengguna menjadwalkan streaming jam 04:00 THEN Scheduler SHALL memulai streaming tidak lebih awal dari jam 04:00
4. WHEN streaming dijadwalkan THEN Scheduler SHALL mencatat log waktu jadwal dan waktu aktual mulai untuk audit

### Requirement 2

**User Story:** Sebagai pengguna, saya ingin jadwal recurring (daily/weekly) dimulai tepat waktu, sehingga siaran berulang saya konsisten.

#### Acceptance Criteria

1. WHEN jadwal recurring daily mencapai waktu yang ditentukan THEN Scheduler SHALL memulai streaming dalam toleransi 1 menit setelah waktu jadwal
2. WHEN jadwal recurring weekly pada hari yang ditentukan mencapai waktu yang ditentukan THEN Scheduler SHALL memulai streaming dalam toleransi 1 menit setelah waktu jadwal
3. WHEN waktu sistem belum mencapai waktu recurring THEN Scheduler SHALL menunggu hingga waktu tercapai

### Requirement 3

**User Story:** Sebagai pengguna, saya ingin sistem tetap dapat menangani jadwal yang terlewat karena restart atau downtime, sehingga siaran tidak terlewat sepenuhnya.

#### Acceptance Criteria

1. WHEN sistem restart dan ada jadwal yang terlewat dalam 5 menit terakhir THEN Scheduler SHALL memulai streaming tersebut
2. WHEN jadwal terlewat lebih dari 5 menit THEN Scheduler SHALL melewatkan jadwal tersebut dan menunggu jadwal berikutnya
3. WHEN menangani jadwal terlewat THEN Scheduler SHALL mencatat log bahwa ini adalah eksekusi jadwal terlewat

