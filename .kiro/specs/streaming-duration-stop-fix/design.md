# Design Document: Streaming Duration Stop Fix

## Overview

Dokumen ini menjelaskan perbaikan untuk masalah livestreaming yang tidak berhenti sesuai durasi yang diinput user. Masalah utama terjadi pada recurring streams (daily/weekly) dimana sistem menggunakan nilai `schedule_time` dan `end_time` yang sudah stale untuk menghitung durasi, bukan `stream_duration_minutes` yang diinput user.

### Root Cause Analysis

Berdasarkan analisis kode, ditemukan beberapa masalah:

1. **Priority Calculation Issue**: Meskipun `calculateDurationSeconds()` sudah memprioritaskan `stream_duration_minutes`, ada beberapa tempat di kode yang masih menggunakan `schedule_time` dan `end_time` untuk menghitung durasi.

2. **Scheduler Duration Check**: `checkStreamDurations()` di `schedulerService.js` sudah menggunakan `stream_duration_minutes` sebagai prioritas, tapi perlu dipastikan konsistensinya.

3. **FFmpeg -t Parameter**: Parameter `-t` sudah diposisikan dengan benar (sebelum output URL), tapi perlu dipastikan nilai yang dikirim benar.

4. **Duration Tracking**: `streamDurationInfo` Map di `streamingService.js` tidak selalu diset dengan benar saat stream dimulai.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│                   (stream_duration_minutes)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Duration Calculator                           │
│              (utils/durationCalculator.js)                       │
│                                                                  │
│  Priority: stream_duration_minutes > schedule calculation        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  FFmpeg Args    │ │  Scheduler      │ │  Duration       │
│  Builder        │ │  Service        │ │  Tracking       │
│                 │ │                 │ │                 │
│  -t parameter   │ │  Force stop     │ │  setDurationInfo│
│  (Layer 1)      │ │  (Layer 2)      │ │  (Layer 3)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Three-Layer Protection

1. **Layer 1 - FFmpeg `-t` Parameter**: FFmpeg akan otomatis berhenti setelah durasi tercapai
2. **Layer 2 - Scheduler Force Stop**: Scheduler memeriksa stream yang melewati durasi dan force stop
3. **Layer 3 - Duration Tracking**: Internal tracking untuk mendeteksi kapan durasi tercapai

## Components and Interfaces

### 1. Duration Calculator (utils/durationCalculator.js)

**Existing Function - No Changes Needed:**
```javascript
function calculateDurationSeconds(stream) {
  // Priority 1: stream_duration_minutes (primary field)
  if (stream.stream_duration_minutes && stream.stream_duration_minutes > 0) {
    return stream.stream_duration_minutes * 60;
  }
  // ... fallback to other fields
}
```

### 2. Streaming Service (services/streamingService.js)

**Fix Required in `startStream()`:**
- Set duration tracking info setelah stream dimulai
- Gunakan `stream_duration_minutes` secara langsung

**Fix Required in `buildFFmpegArgs()` and related functions:**
- Pastikan `stream_duration_minutes` digunakan sebagai prioritas utama
- Log nilai durasi yang digunakan untuk debugging

### 3. Scheduler Service (services/schedulerService.js)

**Fix Required in `checkStreamDurations()`:**
- Pastikan menggunakan `start_time` (bukan `schedule_time`) untuk menghitung end time
- Pastikan `stream_duration_minutes` digunakan sebagai prioritas utama
- Tambahkan logging yang lebih detail untuk debugging

## Data Models

### Stream Table Fields (Existing)

| Field | Type | Description |
|-------|------|-------------|
| stream_duration_minutes | INTEGER | Durasi stream dalam menit (PRIMARY) |
| schedule_time | TEXT | Waktu jadwal (untuk once schedule) |
| end_time | TEXT | Waktu akhir jadwal (untuk once schedule) |
| start_time | TEXT | Waktu aktual stream dimulai |
| schedule_type | TEXT | 'once', 'daily', atau 'weekly' |

### Duration Priority (Existing - Confirmed Correct)

1. `stream_duration_minutes` (primary, in minutes)
2. `end_time - schedule_time` (calculated, for once schedules)
3. `stream_duration_hours` (deprecated)
4. `duration` (legacy)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: FFmpeg Duration Parameter Correctness

*For any* stream with `stream_duration_minutes` set to a positive value, the FFmpeg args array SHALL contain `-t` followed by `stream_duration_minutes * 60` (converted to seconds).

**Validates: Requirements 1.1**

### Property 2: Recurring Stream Duration Priority

*For any* recurring stream (schedule_type = 'daily' or 'weekly') with `stream_duration_minutes` set, the calculated duration SHALL equal `stream_duration_minutes * 60` seconds, regardless of `schedule_time` or `end_time` values.

**Validates: Requirements 1.2**

### Property 3: End Time Calculation from Start Time

*For any* live stream with `start_time` and `stream_duration_minutes` set, the expected end time SHALL equal `start_time + (stream_duration_minutes * 60 * 1000)` milliseconds.

**Validates: Requirements 1.3**

### Property 4: Scheduler Overdue Detection

*For any* live stream where current time exceeds expected end time, the scheduler SHALL detect it as overdue and initiate stop.

**Validates: Requirements 2.1**

### Property 5: Duration Display Format

*For any* `stream_duration_minutes` value, the formatted display SHALL correctly show hours and minutes (e.g., 540 minutes → "9 jam", 545 minutes → "9 jam 5 menit").

**Validates: Requirements 3.1**

### Property 6: Remaining Time Calculation

*For any* live stream with `start_time` and `stream_duration_minutes`, the remaining time SHALL equal `(start_time + stream_duration_minutes * 60000) - current_time`, with minimum value of 0.

**Validates: Requirements 3.2**

## Error Handling

### FFmpeg Exit Codes

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Normal exit (duration reached or manual stop) | Update status based on schedule type |
| Non-zero | Error | Retry up to 3 times if duration not almost reached |
| SIGSEGV | Crash | Retry up to 3 times if duration not almost reached |

### Scheduler Error Handling

- Database errors: Log and skip current check, continue next interval
- Stream not found: Log warning and skip
- Stop stream error: Log error and continue with other streams

## Testing Strategy

### Property-Based Testing

Library: **fast-check** (already used in project)

Configuration:
- Minimum 100 iterations per property test
- Use `fc.integer()` for duration values (1-10080 minutes = 1 week max)
- Use `fc.date()` for time values

### Unit Tests

1. Test `calculateDurationSeconds()` with various stream configurations
2. Test `buildFFmpegArgs()` returns correct `-t` parameter
3. Test `checkStreamDurations()` correctly identifies overdue streams
4. Test `formatDuration()` for various minute values

### Integration Tests

1. Start stream with duration → verify FFmpeg args contain correct `-t`
2. Simulate stream running past duration → verify scheduler stops it
3. Test recurring stream start → verify duration calculated from `stream_duration_minutes`
