# Design Document

## Overview

Dokumen ini menjelaskan desain perbaikan untuk masalah timing pada scheduler streaming. Masalah utama adalah streaming dimulai 2-4 menit lebih awal dari waktu yang dijadwalkan karena logika "early trigger" yang tidak tepat.

## Architecture

Perbaikan dilakukan pada `services/schedulerService.js` dengan mengubah logika trigger window:

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Service                         │
├─────────────────────────────────────────────────────────────┤
│  SEBELUM (Bermasalah):                                      │
│  ├── Trigger Window: -2 menit s/d +10 menit                 │
│  ├── Lookahead: 3 menit (180 detik)                         │
│  └── Hasil: Streaming mulai 2-4 menit lebih awal            │
├─────────────────────────────────────────────────────────────┤
│  SESUDAH (Diperbaiki):                                      │
│  ├── Trigger Window: 0 menit s/d +5 menit                   │
│  ├── Lookahead: 60 detik (1 menit)                          │
│  └── Hasil: Streaming mulai tepat waktu atau max 1 menit    │
│             setelah jadwal                                   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. schedulerService.js

#### Constants yang Diubah

| Constant | Nilai Lama | Nilai Baru | Alasan |
|----------|------------|------------|--------|
| `SCHEDULE_LOOKAHEAD_SECONDS` | 180 (3 menit) | 60 (1 menit) | Mencegah trigger terlalu awal untuk one-time schedule |

#### Functions yang Diubah

**shouldTriggerDaily(stream, currentTime)**
- Sebelum: `timeDiff >= -2 && timeDiff <= 10`
- Sesudah: `timeDiff >= 0 && timeDiff <= 5`
- Alasan: Hanya trigger setelah waktu jadwal tercapai

**shouldTriggerWeekly(stream, currentTime)**
- Sebelum: `timeDiff >= -2 && timeDiff <= 10`
- Sesudah: `timeDiff >= 0 && timeDiff <= 5`
- Alasan: Hanya trigger setelah waktu jadwal tercapai

### 2. Logging Enhancement

Menambahkan log yang lebih jelas untuk debugging:
- Log waktu jadwal vs waktu aktual trigger
- Log apakah ini trigger tepat waktu atau jadwal terlewat

## Data Models

Tidak ada perubahan pada data model. Perubahan hanya pada logika scheduler.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No Early Trigger
*For any* jadwal streaming (daily atau weekly) dengan waktu T, fungsi `shouldTriggerDaily` atau `shouldTriggerWeekly` harus mengembalikan `false` untuk semua waktu sebelum T.
**Validates: Requirements 1.2, 2.3**

### Property 2: Trigger Within Valid Window
*For any* jadwal streaming dengan waktu T, fungsi trigger harus mengembalikan `true` hanya untuk waktu dalam rentang T sampai T+5 menit (inclusive).
**Validates: Requirements 1.1, 2.1, 2.2**

### Property 3: Missed Schedule Boundary
*For any* jadwal dengan waktu T, jika waktu saat ini adalah T+N menit dimana N > 5, maka fungsi trigger harus mengembalikan `false`.
**Validates: Requirements 3.1, 3.2**

## Error Handling

1. **Scheduler Check Failure**: Jika terjadi error saat checking, scheduler akan log error dan melanjutkan ke check berikutnya tanpa crash
2. **Stream Start Failure**: Jika gagal memulai stream, scheduler akan log error dan menghapus dari recently triggered list agar bisa retry
3. **Timezone Conversion Failure**: Fallback ke manual WIB calculation jika Intl.DateTimeFormat gagal

## Testing Strategy

### Unit Tests
- Test `shouldTriggerDaily` dengan berbagai waktu (sebelum, tepat, sesudah jadwal)
- Test `shouldTriggerWeekly` dengan berbagai kombinasi hari dan waktu
- Test edge cases: midnight crossing, timezone edge cases

### Property-Based Tests
Menggunakan Jest dengan fast-check untuk property-based testing:
- Generate random schedule times dan verify trigger behavior
- Verify no early triggers across many random inputs

