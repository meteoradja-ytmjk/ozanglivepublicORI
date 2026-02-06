# Design Document: Stream Templates

## Overview

Fitur Stream Templates memungkinkan user menyimpan konfigurasi stream sebagai template yang bisa digunakan ulang. Template menyimpan semua setting kecuali stream key (untuk keamanan). User dapat membuat, menggunakan, mengedit, dan menghapus template melalui UI yang terintegrasi dengan form stream yang sudah ada.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (EJS)                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Template Selector│  │ Save as Template│                   │
│  │   (Dropdown)     │  │    (Button)     │                   │
│  └────────┬─────────┘  └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────┐                │
│  │         New Stream Modal Form            │                │
│  │  (Auto-fill from template / Save to)     │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────┬───────────────────────────────────────┘
                      │ API Calls
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌─────────────────────────────────────────┐                │
│  │           /api/templates                 │                │
│  │  GET / POST / PUT / DELETE               │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│  ┌─────────────────────────────────────────┐                │
│  │         stream_templates table           │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Schema

Tabel baru `stream_templates` di SQLite:

```sql
CREATE TABLE stream_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  video_id TEXT,
  audio_id TEXT,
  duration_hours INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  loop_video INTEGER DEFAULT 1,
  schedule_type TEXT DEFAULT 'once',
  recurring_time TEXT,
  schedule_days TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name)
);
```

### 2. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/templates | Get all templates for current user |
| POST | /api/templates | Create new template |
| PUT | /api/templates/:id | Update existing template |
| DELETE | /api/templates/:id | Delete template |

### 3. Frontend Components

- **Template Selector Dropdown**: Di bagian atas form new stream modal
- **Save as Template Button**: Di footer modal, sebelum tombol Create Stream
- **Template Name Dialog**: Modal kecil untuk input nama template

## Data Models

### StreamTemplate

```javascript
{
  id: string,           // UUID
  user_id: string,      // Foreign key to users
  name: string,         // Template name (unique per user)
  video_id: string,     // Selected video ID
  audio_id: string,     // Selected audio ID (optional)
  duration_hours: number,
  duration_minutes: number,
  loop_video: boolean,
  schedule_type: 'once' | 'daily' | 'weekly',
  recurring_time: string,  // HH:MM format
  schedule_days: number[], // [0-6] for weekly
  created_at: Date,
  updated_at: Date
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template Save Completeness
*For any* valid stream form state, saving as template SHALL capture and store all required fields (video_id, audio_id, duration_hours, duration_minutes, loop_video, schedule_type, recurring_time, schedule_days).
**Validates: Requirements 1.2, 1.4**

### Property 2: Template Apply Correctness
*For any* saved template, applying it to a form SHALL correctly populate all stored fields with their original values.
**Validates: Requirements 2.2**

### Property 3: Stream Key Security
*For any* template operation (save, load, apply), the stream key SHALL never be stored in or retrieved from the template.
**Validates: Requirements 2.3**

### Property 4: Template Persistence Round-Trip
*For any* template that is created and saved, retrieving templates SHALL return the same template with identical field values.
**Validates: Requirements 4.1, 4.2**

### Property 5: Template List Completeness
*For any* user with N templates, the template list API SHALL return exactly N templates with name and created_at fields present.
**Validates: Requirements 3.1, 3.4**

### Property 6: Template Deletion Permanence
*For any* deleted template, subsequent retrieval attempts SHALL not return the deleted template.
**Validates: Requirements 4.3**

## Error Handling

1. **Duplicate Name**: Prompt user to overwrite or choose different name
2. **Missing Required Fields**: Show validation error before saving
3. **Template Not Found**: Show error message if template deleted by another session
4. **Database Error**: Revert to previous state and show error notification

## Testing Strategy

### Unit Tests
- Test template model validation
- Test API endpoint handlers
- Test database operations (CRUD)

### Property-Based Tests
Menggunakan Jest dengan fast-check:

1. **Property 1**: Generate random form states, save as template, verify all fields stored
2. **Property 2**: Generate random templates, apply to form, verify all fields match
3. **Property 3**: Generate templates with stream key in input, verify stream key not in output
4. **Property 4**: Create template, retrieve, compare all fields
5. **Property 5**: Create N templates, list, verify count and required fields
6. **Property 6**: Create template, delete, verify not in list

### Integration Tests
- End-to-end flow: create template → apply to new stream → verify stream created with template values
