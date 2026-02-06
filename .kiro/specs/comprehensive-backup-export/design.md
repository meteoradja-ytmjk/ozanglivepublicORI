# Design Document: Comprehensive Backup Export

## Overview

Fitur Comprehensive Backup Export memperluas kemampuan backup service yang ada untuk mendukung export dan import semua data aplikasi StreamFlow. Ini mencakup streams, YouTube credentials, broadcast templates, recurring schedules, stream templates, dan playlists. Fitur ini memungkinkan user untuk melakukan backup lengkap dan restore data untuk migrasi atau disaster recovery.

## Architecture

```mermaid
graph TB
    subgraph "Frontend"
        UI[Settings Page UI]
        ExportBtn[Export Button]
        ImportBtn[Import Button]
        CategorySelect[Category Selector]
    end
    
    subgraph "Backend API"
        ExportAPI[/api/backup/export-all]
        ImportAPI[/api/backup/import-all]
    end
    
    subgraph "Backup Service"
        ComprehensiveExport[comprehensiveExport]
        ComprehensiveImport[comprehensiveImport]
        CategoryExporter[Category Exporters]
        CategoryImporter[Category Importers]
        Validator[Backup Validator]
    end
    
    subgraph "Models"
        Stream[Stream]
        YTCreds[YouTubeCredentials]
        BroadcastTpl[BroadcastTemplate]
        RecurringSchedule[RecurringSchedule]
        StreamTpl[StreamTemplate]
        Playlist[Playlist]
    end
    
    UI --> ExportBtn
    UI --> ImportBtn
    UI --> CategorySelect
    ExportBtn --> ExportAPI
    ImportBtn --> ImportAPI
    CategorySelect --> ExportAPI
    
    ExportAPI --> ComprehensiveExport
    ImportAPI --> ComprehensiveImport
    
    ComprehensiveExport --> CategoryExporter
    ComprehensiveImport --> Validator
    ComprehensiveImport --> CategoryImporter
    
    CategoryExporter --> Stream
    CategoryExporter --> YTCreds
    CategoryExporter --> BroadcastTpl
    CategoryExporter --> RecurringSchedule
    CategoryExporter --> StreamTpl
    CategoryExporter --> Playlist
    
    CategoryImporter --> Stream
    CategoryImporter --> YTCreds
    CategoryImporter --> BroadcastTpl
    CategoryImporter --> RecurringSchedule
    CategoryImporter --> StreamTpl
    CategoryImporter --> Playlist
```

## Components and Interfaces

### 1. Extended Backup Service (`services/backupService.js`)

```javascript
// New export fields for each category
const YOUTUBE_CREDENTIALS_FIELDS = [
  'channel_name', 'channel_id', 'client_id', 'client_secret', 
  'refresh_token', 'is_primary'
];

const BROADCAST_TEMPLATE_FIELDS = [
  'name', 'title', 'description', 'privacy_status', 'tags', 
  'category_id', 'thumbnail_path', 'stream_id', 'account_id',
  'recurring_enabled', 'recurring_pattern', 'recurring_time', 
  'recurring_days', 'next_run_at', 'last_run_at'
];

const RECURRING_SCHEDULE_FIELDS = [
  'name', 'pattern', 'schedule_time', 'days_of_week', 'template_id',
  'account_id', 'title_template', 'description', 'privacy_status',
  'tags', 'category_id', 'is_active', 'next_run_at', 'last_run_at'
];

const STREAM_TEMPLATE_FIELDS = [
  'name', 'video_id', 'audio_id', 'duration_hours', 'duration_minutes',
  'loop_video', 'schedule_type', 'recurring_time', 'schedule_days'
];

const PLAYLIST_FIELDS = [
  'name', 'description', 'is_shuffle'
];

// Main export function
async function comprehensiveExport(userId, categories = null) {
  // Returns structured backup object with all selected categories
}

// Main import function  
async function comprehensiveImport(backupData, userId, options = {}) {
  // Imports data in correct order, returns detailed results
}
```

### 2. API Endpoints (`app.js`)

```javascript
// Export all data
POST /api/backup/export-all
Body: { categories: ['streams', 'youtube_credentials', ...] } // optional

// Import all data
POST /api/backup/import-all
Body: { backup: {...}, options: { skipDuplicates: true, overwrite: false } }
```

### 3. Category Exporters

Each category has a dedicated exporter function:

```javascript
async function exportYouTubeCredentials(userId)
async function exportBroadcastTemplates(userId)
async function exportRecurringSchedules(userId)
async function exportStreamTemplates(userId)
async function exportPlaylists(userId)
```

### 4. Category Importers

Each category has a dedicated importer function with validation:

```javascript
async function importYouTubeCredentials(credentials, userId, options)
async function importBroadcastTemplates(templates, userId, options)
async function importRecurringSchedules(schedules, userId, options)
async function importStreamTemplates(templates, userId, options)
async function importPlaylists(playlists, userId, options)
```

## Data Models

### Comprehensive Backup Format

```json
{
  "metadata": {
    "exportDate": "2025-12-27T10:00:00.000Z",
    "appVersion": "1.0.0",
    "exportType": "comprehensive",
    "counts": {
      "streams": 5,
      "youtube_credentials": 2,
      "broadcast_templates": 3,
      "recurring_schedules": 2,
      "stream_templates": 4,
      "playlists": 2
    }
  },
  "streams": [...],
  "youtube_credentials": [...],
  "broadcast_templates": [...],
  "recurring_schedules": [...],
  "stream_templates": [...],
  "playlists": [
    {
      "name": "My Playlist",
      "description": "Description",
      "is_shuffle": false,
      "videos": [
        { "video_id": "uuid-1", "position": 1 },
        { "video_id": "uuid-2", "position": 2 }
      ]
    }
  ]
}
```

### Import Result Format

```json
{
  "success": true,
  "results": {
    "streams": { "imported": 5, "skipped": 0, "errors": [] },
    "youtube_credentials": { "imported": 2, "skipped": 0, "errors": [] },
    "broadcast_templates": { "imported": 3, "skipped": 0, "errors": [] },
    "recurring_schedules": { "imported": 2, "skipped": 0, "errors": [] },
    "stream_templates": { "imported": 4, "skipped": 0, "errors": [] },
    "playlists": { "imported": 2, "skipped": 0, "errors": [] }
  },
  "warnings": []
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified after eliminating redundancy:

### Property 1: Round-trip consistency for all categories
*For any* valid backup data containing streams, YouTube credentials, broadcast templates, recurring schedules, stream templates, and playlists, exporting then importing should produce entities with equivalent configuration values.
**Validates: Requirements 8.1**

### Property 2: Comprehensive export includes all categories
*For any* user with data in multiple categories, when comprehensive export is called without category selection, the export should contain all six categories (streams, youtube_credentials, broadcast_templates, recurring_schedules, stream_templates, playlists) with correct entity counts in metadata.
**Validates: Requirements 1.1, 1.3, 2.2**

### Property 3: Selective export respects category selection
*For any* subset of categories selected for export, the resulting backup should contain only the selected categories and no others.
**Validates: Requirements 2.1**

### Property 4: Field completeness for each category
*For any* exported entity, all required fields for that category should be present and match the original values (YouTube credentials fields, broadcast template fields including recurring config, recurring schedule fields, stream template fields, playlist fields with video positions).
**Validates: Requirements 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2**

### Property 5: Playlist video order preservation
*For any* playlist with videos, the exported and imported video positions should maintain the same sequential order as the original.
**Validates: Requirements 6.3**

### Property 6: Import validation rejects invalid data
*For any* backup with missing required fields (e.g., credentials without refresh_token, templates with incomplete recurring config), the import should reject the invalid entries and report errors while continuing with valid data.
**Validates: Requirements 7.1, 8.2, 8.3, 8.4**

### Property 7: Import result reporting accuracy
*For any* import operation, the result should accurately report the count of imported, skipped, and failed entities for each category present in the backup.
**Validates: Requirements 7.3**

### Property 8: Duplicate handling options work correctly
*For any* import with existing data, when skipDuplicates is true, duplicates should be skipped; when overwrite is true, existing entries should be updated.
**Validates: Requirements 7.4**

## Error Handling

### Export Errors
- **Database connection failure**: Return error with message, no partial export
- **Empty data**: Return valid backup with empty arrays and zero counts
- **Invalid user ID**: Return error indicating user not found

### Import Errors
- **Invalid JSON structure**: Reject entire import with validation error
- **Missing metadata**: Reject import, require valid metadata
- **Invalid category data**: Skip invalid entries, log warnings, continue with valid data
- **Referential integrity failure**: Log warning, import entity without reference
- **Duplicate entry**: Based on options, either skip or overwrite

### Error Response Format
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "youtube_credentials[0]: Missing refresh_token",
    "broadcast_templates[2]: Invalid recurring_pattern"
  ]
}
```

## Testing Strategy

### Property-Based Testing Library
- **Library**: fast-check (JavaScript property-based testing library)
- **Minimum iterations**: 100 per property test

### Unit Tests
- Test individual category exporters with known data
- Test individual category importers with valid and invalid data
- Test validation functions for each category
- Test duplicate detection logic

### Property-Based Tests
Each correctness property will be implemented as a property-based test:

1. **Round-trip test**: Generate random valid data for all categories, export, import to new user, compare
2. **Comprehensive export test**: Generate random data, verify all categories present
3. **Selective export test**: Generate random category selection, verify only selected present
4. **Field completeness test**: Generate random entities, verify all fields preserved
5. **Playlist order test**: Generate random playlists with videos, verify order preserved
6. **Validation test**: Generate invalid data variations, verify rejection
7. **Result reporting test**: Generate mixed valid/invalid data, verify accurate counts
8. **Duplicate handling test**: Generate duplicates, test both skip and overwrite modes

### Test Annotations
Each property-based test will be annotated with:
```javascript
// **Feature: comprehensive-backup-export, Property 1: Round-trip consistency**
// **Validates: Requirements 8.1**
```

### Integration Tests
- Full export/import cycle with real database
- API endpoint tests for /api/backup/export-all and /api/backup/import-all
- UI interaction tests for export/import buttons

