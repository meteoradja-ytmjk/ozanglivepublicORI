# Design Document: Duration Format Update

## Overview

Fitur ini mengubah input durasi streaming dari format jam saja menjadi format jam dan menit. Perubahan meliputi:
1. UI form dengan dua field input (jam dan menit)
2. Penyimpanan durasi dalam satuan menit untuk presisi lebih baik
3. Display durasi dalam format "X jam Y menit"
4. Backward compatibility dengan data existing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (EJS)                           │
├─────────────────────────────────────────────────────────────────┤
│  dashboard.ejs                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Duration Input Section                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐                     │   │
│  │  │ Hours Input  │  │ Minutes Input│                     │   │
│  │  │ (0-168)      │  │ (0-59)       │                     │   │
│  │  └──────────────┘  └──────────────┘                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  JavaScript Functions                                    │   │
│  │  - calculateTotalMinutes(hours, minutes)                │   │
│  │  - formatDuration(totalMinutes)                         │   │
│  │  - parseDurationToFields(totalMinutes)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (app.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/streams                                              │
│  PUT /api/streams/:id                                           │
│  - Receive streamDurationHours and streamDurationMinutes        │
│  - Calculate total minutes: (hours × 60) + minutes              │
│  - Store in stream_duration_minutes column                      │
│                                                                 │
│  GET /api/streams                                               │
│  - Return stream_duration_minutes                               │
│  - Frontend handles formatting                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database (SQLite)                          │
├─────────────────────────────────────────────────────────────────┤
│  streams table                                                  │
│  - stream_duration_hours: INTEGER (deprecated, for migration)   │
│  - stream_duration_minutes: INTEGER (new field)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Frontend Components

#### Duration Input Fields (dashboard.ejs)
```html
<!-- Duration Input Section -->
<div class="grid grid-cols-2 gap-2">
  <div>
    <label class="text-sm font-medium text-white block mb-2">Jam</label>
    <input type="number" id="streamDurationHours" name="streamDurationHours" 
           min="0" max="168" class="w-full px-3 py-2.5 bg-dark-700 border border-gray-600 rounded-lg text-sm" 
           placeholder="0">
  </div>
  <div>
    <label class="text-sm font-medium text-white block mb-2">Menit</label>
    <input type="number" id="streamDurationMinutes" name="streamDurationMinutes" 
           min="0" max="59" class="w-full px-3 py-2.5 bg-dark-700 border border-gray-600 rounded-lg text-sm" 
           placeholder="0">
  </div>
</div>
```

#### JavaScript Utility Functions
```javascript
// Calculate total minutes from hours and minutes
function calculateTotalMinutes(hours, minutes) {
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  return (h * 60) + m;
}

// Format total minutes to display string
function formatDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '-';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours} jam ${minutes} menit`;
  } else if (hours > 0) {
    return `${hours} jam`;
  } else {
    return `${minutes} menit`;
  }
}

// Parse total minutes to hours and minutes fields
function parseDurationToFields(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) {
    return { hours: '', minutes: '' };
  }
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}
```

### 2. Backend API Changes

#### POST /api/streams (Create Stream)
```javascript
// Receive both hours and minutes from form
const hours = parseInt(req.body.streamDurationHours) || 0;
const minutes = parseInt(req.body.streamDurationMinutes) || 0;
const totalMinutes = (hours * 60) + minutes;

streamData.stream_duration_minutes = totalMinutes > 0 ? totalMinutes : null;
```

#### PUT /api/streams/:id (Update Stream)
```javascript
// Handle duration update
if (req.body.streamDurationHours !== undefined || req.body.streamDurationMinutes !== undefined) {
  const hours = parseInt(req.body.streamDurationHours) || 0;
  const minutes = parseInt(req.body.streamDurationMinutes) || 0;
  const totalMinutes = (hours * 60) + minutes;
  updateData.stream_duration_minutes = totalMinutes > 0 ? totalMinutes : null;
}
```

### 3. Database Migration

```javascript
// Add stream_duration_minutes column
db.run(`ALTER TABLE streams ADD COLUMN stream_duration_minutes INTEGER`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding stream_duration_minutes column:', err.message);
  }
});

// Migrate existing data from hours to minutes
db.run(`UPDATE streams SET stream_duration_minutes = stream_duration_hours * 60 
        WHERE stream_duration_hours IS NOT NULL AND stream_duration_minutes IS NULL`);
```

## Data Models

### Stream Model (Updated)
```javascript
{
  id: String,
  title: String,
  video_id: String,
  audio_id: String | null,
  rtmp_url: String,
  stream_key: String,
  stream_duration_hours: Number | null,    // Deprecated, kept for backward compatibility
  stream_duration_minutes: Number | null,  // New field - total duration in minutes
  loop_video: Boolean,
  status: 'offline' | 'live' | 'scheduled',
  schedule_type: 'once' | 'daily' | 'weekly',
  schedule_time: String | null,
  end_time: String | null,
  // ... other fields
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Hours validation range
*For any* input value for hours field, the system SHALL accept only integer values from 0 to 168 inclusive.
**Validates: Requirements 1.2**

### Property 2: Minutes validation range
*For any* input value for minutes field, the system SHALL accept only integer values from 0 to 59 inclusive.
**Validates: Requirements 1.3**

### Property 3: Total minutes calculation correctness
*For any* valid hours (0-168) and minutes (0-59) combination, the calculated total minutes SHALL equal (hours × 60) + minutes.
**Validates: Requirements 1.4**

### Property 4: Duration format correctness
*For any* total minutes value greater than 0, the formatted string SHALL correctly represent the duration:
- If hours > 0 and minutes > 0: "X jam Y menit"
- If hours > 0 and minutes = 0: "X jam"
- If hours = 0 and minutes > 0: "Y menit"
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Duration round-trip consistency
*For any* valid total minutes value, parsing to hours/minutes fields and then calculating back to total minutes SHALL produce the original value.
**Validates: Requirements 2.4**

### Property 6: Backward compatibility conversion
*For any* existing stream_duration_hours value, the converted stream_duration_minutes SHALL equal stream_duration_hours × 60.
**Validates: Requirements 3.1**

## Error Handling

1. **Invalid Input Values**
   - Hours < 0 or > 168: Reset to valid range (0 or 168)
   - Minutes < 0 or > 59: Reset to valid range (0 or 59)
   - Non-numeric input: Treat as 0

2. **Empty Duration**
   - Both hours and minutes empty/0: Store null in database
   - Display "-" in table

3. **Database Migration Errors**
   - Log error but don't crash application
   - Existing data remains accessible via stream_duration_hours

## Testing Strategy

### Unit Tests
- Test calculateTotalMinutes with various hour/minute combinations
- Test formatDuration with edge cases (0, only hours, only minutes, both)
- Test parseDurationToFields round-trip

### Property-Based Tests
Using fast-check library for property-based testing:

1. **Property 1 & 2**: Validation range tests
2. **Property 3**: Total minutes calculation
3. **Property 4**: Format correctness
4. **Property 5**: Round-trip consistency
5. **Property 6**: Backward compatibility

Each property-based test MUST:
- Run minimum 100 iterations
- Be tagged with format: `**Feature: duration-format-update, Property {number}: {property_text}**`
- Reference the correctness property from design document
