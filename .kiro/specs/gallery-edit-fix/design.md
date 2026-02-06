# Design Document: Gallery Edit Fix

## Overview

Dokumen ini menjelaskan desain perbaikan untuk tiga bug pada aplikasi StreamFlow:
1. Durasi stream tidak tersimpan saat edit
2. Icon action tidak terlihat karena masalah CSS visibility
3. Icon tidak berwarna pada mobile view

## Architecture

Perbaikan ini melibatkan tiga komponen:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (EJS/JS)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  dashboard.ejs  │  │  stream-modal.js │  │  styles.css  │ │
│  │  (renderStreams)│  │  (form submit)   │  │  (icon CSS)  │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┘ │
│           │                    │                             │
└───────────┼────────────────────┼─────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Express)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  app.js - PUT /api/streams/:id                          ││
│  │  - Add stream_duration_hours to updateData              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Backend API Fix (app.js)

**Current Issue:** Endpoint PUT `/api/streams/:id` tidak memproses field `streamDuration` dari request body.

**Solution:** Tambahkan handling untuk `stream_duration_hours` di updateData object.

```javascript
// Di endpoint PUT /api/streams/:id
if (req.body.streamDuration !== undefined) {
  updateData.stream_duration_hours = req.body.streamDuration ? parseInt(req.body.streamDuration) : null;
}
```

### 2. Frontend Icon Visibility Fix (dashboard.ejs)

**Current Issue:** Icon yang di-render dinamis via JavaScript tidak mendapat class `font-loaded`, sehingga tetap `visibility: hidden`.

**Solution:** Setelah merender stream list, tambahkan class `font-loaded` ke semua icon baru.

```javascript
function renderStreams(streams) {
  // ... existing render code ...
  
  // Setelah render selesai, tambahkan font-loaded class ke semua icon baru
  document.querySelectorAll('.ti:not(.font-loaded)').forEach(icon => {
    icon.classList.add('font-loaded');
  });
}
```

### 3. CSS Alternative Fix (styles.css)

**Alternative Solution:** Ubah CSS rule untuk icon agar tidak perlu class `font-loaded`.

```css
/* Hapus atau modifikasi rule ini */
.ti {
  visibility: hidden;
}

.ti.font-loaded {
  visibility: visible;
}

/* Ganti dengan pendekatan yang lebih baik menggunakan font-display */
```

## Data Models

Tidak ada perubahan pada data model. Field `stream_duration_hours` sudah ada di tabel streams.

```
streams table:
- id: UUID
- title: String
- video_id: UUID
- audio_id: UUID | null
- rtmp_url: String
- stream_key: String
- stream_duration_hours: Integer | null  <-- Field yang perlu diupdate
- loop_video: Boolean
- status: 'offline' | 'live' | 'scheduled'
- ...
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Duration update round trip
*For any* stream with a valid duration value, updating the stream via PUT endpoint and then fetching it via GET endpoint SHALL return the same duration value that was sent in the update request.

**Validates: Requirements 1.1**

### Property 2: Icon font-loaded class application
*For any* dynamically rendered stream list, after renderStreams() completes, all elements with class `ti` SHALL also have the class `font-loaded`.

**Validates: Requirements 2.1, 3.2**

## Error Handling

1. **Invalid duration value**: Jika `streamDuration` bukan angka valid, gunakan `parseInt()` yang akan menghasilkan `NaN`, lalu set ke `null`.

2. **Empty duration**: Jika `streamDuration` adalah string kosong atau undefined, set `stream_duration_hours` ke `null`.

3. **Font loading failure**: Jika font gagal load, icon tetap akan visible karena kita menambahkan `font-loaded` class secara programatis.

## Testing Strategy

### Unit Tests
- Test endpoint PUT `/api/streams/:id` dengan berbagai nilai duration
- Test bahwa duration null/empty ditangani dengan benar

### Property-Based Tests
Library: fast-check (sudah digunakan di project)

**Property Test 1: Duration Update Round Trip**
- Generate random duration values (1-168 hours)
- Update stream dengan duration tersebut
- Verify GET returns same duration

**Property Test 2: Icon Class Application**
- Render streams dengan berbagai jumlah items
- Verify semua `.ti` elements memiliki `.font-loaded` class

### Integration Tests
- Test full flow: create stream → edit duration → verify saved
- Test mobile view icon visibility
