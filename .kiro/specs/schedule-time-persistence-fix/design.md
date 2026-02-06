# Design Document: Schedule Time Persistence Fix

## Overview

Dokumen ini menjelaskan perbaikan untuk masalah waktu penjadwalan stream yang berubah ketika user membuka kembali form edit. Masalah utama terjadi karena penggunaan `toISOString().slice(0, 16)` yang mengkonversi waktu ke UTC, bukan waktu lokal, saat menampilkan di input datetime-local.

### Root Cause Analysis

1. **Masalah Display**: Kode `new Date(stream.schedule_time).toISOString().slice(0, 16)` menghasilkan waktu UTC, bukan waktu lokal
2. **Masalah Save**: Kode `new Date(scheduleTime).toISOString()` mengkonversi waktu lokal ke UTC dengan benar, tapi karena display salah, waktu yang disimpan juga salah
3. **Efek Kumulatif**: Setiap kali form dibuka dan disimpan, waktu bergeser karena konversi timezone yang tidak konsisten

### Solution

Menggunakan fungsi helper untuk mengkonversi UTC ke format datetime-local yang benar (waktu lokal), dan memastikan konversi yang konsisten saat save.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (EJS)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Display Time   │    │   Save Time     │                     │
│  │  UTC → Local    │    │  Local → UTC    │                     │
│  │  (for input)    │    │  (for API)      │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Helper Functions                                ││
│  │  - formatDateTimeLocal(isoString)  // UTC → Local format    ││
│  │  - parseLocalDateTime(localString) // Local → Date object   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (app.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              parseLocalDateTime(dateTimeString)              ││
│  │  - Parse YYYY-MM-DDTHH:MM as local time                     ││
│  │  - Return Date object in local timezone                      ││
│  │  - Convert to ISO string for storage                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database (SQLite)                           │
├─────────────────────────────────────────────────────────────────┤
│  schedule_time: TEXT (ISO 8601 UTC format)                      │
│  end_time: TEXT (ISO 8601 UTC format)                           │
│  recurring_time: TEXT (HH:MM local time format)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Frontend Helper Function: formatDateTimeLocal

```javascript
/**
 * Convert ISO UTC string to datetime-local input format (local time)
 * @param {string} isoString - ISO 8601 UTC string from database
 * @returns {string} - Format YYYY-MM-DDTHH:MM in local timezone
 */
function formatDateTimeLocal(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
```

### 2. Files to Modify

| File | Changes |
|------|---------|
| views/schedule.ejs | Replace `toISOString().slice(0, 16)` with `formatDateTimeLocal()` |
| views/dashboard.ejs | Replace `toISOString().slice(0, 16)` with `formatDateTimeLocal()` |

### 3. Affected Code Locations

**schedule.ejs:**
- Line ~510: `document.getElementById('editScheduleTime').value = new Date(stream.schedule_time).toISOString().slice(0, 16);`
- Line ~513: `document.getElementById('editEndTime').value = new Date(stream.end_time).toISOString().slice(0, 16);`

**dashboard.ejs:**
- Line ~1803: `document.getElementById('scheduleStartTime').value = startDate.toISOString().slice(0, 16);`
- Line ~1807: `document.getElementById('scheduleEndTime').value = endDate.toISOString().slice(0, 16);`
- Line ~2060: `document.getElementById('scheduleEditStartTime').value = new Date(stream.schedule_time).toISOString().slice(0, 16);`
- Line ~2063: `document.getElementById('scheduleEditEndTime').value = new Date(stream.end_time).toISOString().slice(0, 16);`

## Data Models

Tidak ada perubahan pada data model. Format penyimpanan tetap:
- `schedule_time`: ISO 8601 UTC string
- `end_time`: ISO 8601 UTC string
- `recurring_time`: HH:MM string (local time)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schedule Time Round-Trip Consistency
*For any* valid schedule_time in UTC format, converting to local datetime-local format for display and then parsing back to UTC should produce the same original UTC time (within the same minute).
**Validates: Requirements 1.1, 1.2, 1.3, 3.2, 3.3**

### Property 2: End Time Round-Trip Consistency
*For any* valid end_time in UTC format, converting to local datetime-local format for display and then parsing back to UTC should produce the same original UTC time (within the same minute).
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Recurring Time Preservation
*For any* recurring_time in HH:MM format, storing and retrieving should return the exact same HH:MM string without any conversion.
**Validates: Requirements 4.1, 4.3, 5.2**

### Property 4: Local Time Display Correctness
*For any* UTC timestamp, the formatDateTimeLocal function should return a string that when parsed as local time produces a Date object with the same local hour and minute as the original UTC time converted to local timezone.
**Validates: Requirements 3.1, 5.3**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid/null schedule_time | Return empty string for display |
| Invalid date format | Gracefully fallback to empty string |
| Timezone detection failure | Use browser's default timezone |

## Testing Strategy

### Unit Tests
- Test `formatDateTimeLocal()` with various UTC timestamps
- Test round-trip conversion (UTC → local → UTC)
- Test edge cases: midnight, end of month, DST transitions

### Property-Based Tests
Using fast-check library for JavaScript:

1. **Round-trip property test**: Generate random UTC timestamps, convert to local format, parse back, verify equality
2. **Format correctness test**: Verify output format matches YYYY-MM-DDTHH:MM pattern
3. **Recurring time preservation test**: Verify HH:MM strings are unchanged after save/load cycle

### Integration Tests
- Create schedule with specific time, reload page, verify time unchanged
- Edit schedule without changing time, save, verify database unchanged
- Test all schedule types: once, daily, weekly

### Test Configuration
- Property-based tests should run minimum 100 iterations
- Each test should be tagged with the correctness property it validates
