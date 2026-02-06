# Design Document: Schedule Time Input Fix

## Overview

Perbaikan ini bertujuan untuk meningkatkan responsivitas dan stabilitas input jam pada schedule di dashboard. Masalah utama yang diidentifikasi adalah input time inline yang terlalu kecil, mudah hilang karena blur event yang terlalu cepat, dan kurangnya visual feedback.

## Architecture

Perbaikan dilakukan pada komponen inline edit di `views/dashboard.ejs`. Tidak ada perubahan arsitektur besar, hanya perbaikan pada fungsi JavaScript yang menangani inline editing.

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard View                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Stream Table                        │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │         Schedule Cell (clickable)        │    │    │
│  │  │  ┌─────────────────────────────────┐    │    │    │
│  │  │  │   Time Input (inline edit)      │    │    │    │
│  │  │  │   - Larger width (100px+)       │    │    │    │
│  │  │  │   - Debounced blur (300ms)      │    │    │    │
│  │  │  │   - Save lock mechanism         │    │    │    │
│  │  │  └─────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. createScheduleInlineEdit(cell, streamId, currentSchedule)

Fungsi yang membuat input time inline pada schedule cell.

**Perubahan:**
- Meningkatkan lebar input dari `w-20` ke `w-25`
- Menambahkan debounce pada blur event (300ms)
- Menambahkan flag `isSaving` untuk mencegah duplicate save
- Menambahkan `select()` pada focus untuk memudahkan penggantian nilai

### 2. saveScheduleInlineEdit(streamId, scheduleType, recurringTime, cell)

Fungsi yang menyimpan perubahan schedule ke server.

**Perubahan:**
- Menambahkan save lock untuk mencegah duplicate requests
- Memastikan cleanup state setelah save selesai

### 3. cancelInlineEdit()

Fungsi yang membatalkan inline edit dan mengembalikan nilai asli.

**Tidak ada perubahan signifikan.**

## Data Models

Tidak ada perubahan pada data model. Struktur data schedule tetap sama:

```javascript
{
  schedule_type: 'daily' | 'weekly' | 'once',
  recurring_time: 'HH:MM' | null,
  schedule_days: number[] // untuk weekly
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Input Visibility Persistence
*For any* schedule cell click event, the time input element SHALL remain in the DOM and visible until an explicit save (Enter key, blur after delay) or cancel (Escape key) action occurs.
**Validates: Requirements 1.1**

### Property 2: Save Lock Prevents Duplicates
*For any* sequence of rapid save attempts on the same schedule cell, only the first save request SHALL be sent to the server while `isSaving` flag is true.
**Validates: Requirements 3.3**

## Error Handling

1. **API Error**: Jika save gagal, cell dikembalikan ke nilai asli menggunakan `originalHtml` yang disimpan
2. **Network Error**: Sama seperti API error, revert ke nilai asli
3. **Invalid Time Format**: Browser native time input sudah menangani validasi format

## Testing Strategy

### Unit Tests
- Test fungsi `createScheduleInlineEdit` membuat input dengan properti yang benar
- Test fungsi `saveScheduleInlineEdit` mengirim request dengan data yang benar
- Test fungsi `cancelInlineEdit` mengembalikan nilai asli

### Property-Based Tests
Menggunakan Jest dengan fast-check untuk property-based testing:

1. **Property 1**: Test bahwa input tetap visible setelah berbagai interaksi
2. **Property 2**: Test bahwa save lock mencegah duplicate requests

### Integration Tests
- Test end-to-end flow: click cell → edit time → save → verify update
- Test cancel flow: click cell → edit time → escape → verify revert
