# Design Document: Backup Import Fix

## Overview

Dokumen ini menjelaskan desain perbaikan untuk sistem import backup pada aplikasi StreamFlow. Masalah utama adalah ketidakkonsistenan antara data yang di-export dan data yang di-import, menyebabkan beberapa stream tidak muncul di list yang seharusnya.

## Architecture

Perbaikan dilakukan pada `backupService.js` dengan fokus pada:
1. Memperluas `EXPORT_FIELDS` untuk mencakup semua field konfigurasi yang diperlukan
2. Memperbaiki logika penentuan status saat import
3. Memastikan semua field diproses dengan benar saat import

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Export API    │────▶│  Backup Service  │────▶│   JSON File     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Import API    │────▶│  Backup Service  │────▶│  Stream Model   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Components and Interfaces

### 1. backupService.js

#### EXPORT_FIELDS (Updated)
```javascript
const EXPORT_FIELDS = [
  'title',
  'rtmp_url',
  'stream_key',
  'platform',
  'platform_icon',
  'bitrate',
  'resolution',
  'fps',
  'orientation',
  'loop_video',
  'schedule_type',
  'schedule_days',
  'schedule_time',        // ADDED: untuk one-time schedule
  'recurring_time',
  'recurring_enabled',
  'stream_duration_hours',
  'stream_duration_minutes' // ADDED: untuk durasi dalam menit
];
```

#### importStreams Function (Updated Logic)
- Menentukan status berdasarkan konfigurasi schedule:
  - `scheduled` jika `schedule_type` adalah `daily` atau `weekly`
  - `scheduled` jika `schedule_time` ada dan valid
  - `offline` jika tidak ada schedule

### 2. Status Determination Logic

```javascript
function determineImportStatus(streamConfig) {
  // Recurring schedules (daily/weekly) should be scheduled
  if (streamConfig.schedule_type === 'daily' || streamConfig.schedule_type === 'weekly') {
    return 'scheduled';
  }
  
  // One-time schedule with schedule_time should be scheduled
  if (streamConfig.schedule_time) {
    return 'scheduled';
  }
  
  // Default to offline
  return 'offline';
}
```

## Data Models

### Stream Configuration (Export/Import)
```typescript
interface StreamConfig {
  title: string;
  rtmp_url: string;
  stream_key: string;
  platform?: string;
  platform_icon?: string;
  bitrate?: number;
  resolution?: string;
  fps?: number;
  orientation?: 'horizontal' | 'vertical';
  loop_video?: boolean;
  schedule_type?: 'once' | 'daily' | 'weekly';
  schedule_days?: number[];
  schedule_time?: string;        // ISO date string for one-time schedule
  recurring_time?: string;       // HH:MM format for recurring
  recurring_enabled?: boolean;
  stream_duration_hours?: number;
  stream_duration_minutes?: number;
}
```

### Backup File Format
```typescript
interface BackupFile {
  metadata?: {
    exportDate: string;
    appVersion: string;
    totalStreams: number;
  };
  streams: StreamConfig[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Export Completeness
*For any* stream with configuration fields set, when exported, the backup data SHALL contain all those fields with their exact values preserved.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Import Status Determination
*For any* backup data with streams, when imported:
- Streams with `schedule_type` of `daily` or `weekly` SHALL have status `scheduled`
- Streams with `schedule_time` set SHALL have status `scheduled`
- Streams without schedule configuration SHALL have status `offline`
**Validates: Requirements 2.1, 2.2, 4.1, 4.2, 4.3**

### Property 3: Import Field Preservation
*For any* backup data with streams, when imported, the created streams SHALL have all configuration fields preserved including `stream_duration_minutes`, `schedule_days`, `recurring_time`, and `recurring_enabled`.
**Validates: Requirements 2.3, 2.4, 3.2, 3.3**

### Property 4: Round-trip Consistency
*For any* set of streams, exporting then importing SHALL produce streams with equivalent configuration values for all exported fields.
**Validates: Requirements 3.1**

## Error Handling

1. **Invalid JSON**: Return error dengan pesan jelas
2. **Missing Required Fields**: Skip stream dan laporkan di errors array
3. **Invalid Field Values**: Gunakan default values dan lanjutkan import

## Testing Strategy

### Property-Based Testing Library
Menggunakan **fast-check** untuk property-based testing (sudah ada di project).

### Test Configuration
- Minimum 100 iterations per property test
- Setiap test di-tag dengan format: `**Feature: backup-import-fix, Property {number}: {property_text}**`

### Unit Tests
- Test untuk `determineImportStatus` function
- Test untuk edge cases (empty arrays, null values)

### Property-Based Tests
1. **Property 1**: Generate random streams, export, verify all fields present
2. **Property 2**: Generate backup data with various schedule configs, import, verify status
3. **Property 3**: Generate backup data, import, verify field values match
4. **Property 4**: Generate streams, export, import, verify equivalence
